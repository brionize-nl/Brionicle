#!/usr/bin/env node
'use strict';

const puppeteer = require('puppeteer');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

class BrionicleCapture {
    constructor(config) {
        this.config = config;
        this.browser = null;
        this.cameras = new Map();
        this.pollTimer = null;
        this.running = false;

        this.s3 = new S3Client({
            region: 'auto',
            endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: config.r2.accessKeyId,
                secretAccessKey: config.r2.secretAccessKey,
            },
        });
    }

    log(msg) {
        const ts = new Date().toLocaleTimeString('nl-NL');
        console.log(`[${ts}] ${msg}`);
    }

    async start() {
        this.running = true;
        this.log('Brionicle Capture starten...');

        await this.launchBrowser();
        this.log('Browser gestart');

        await this.poll();
        this.pollTimer = setInterval(() => this.poll(), this.config.pollInterval || 3000);

        this.log('Wachten op camera verzoeken...');
    }

    async launchBrowser() {
        if (this.browser) {
            try { await this.browser.close(); } catch {}
        }

        this.browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-default-apps',
                '--no-first-run',
                '--mute-audio',
            ],
            ...(this.config.chromePath ? { executablePath: this.config.chromePath } : {}),
        });

        this.browser.on('disconnected', () => {
            if (this.running) {
                this.log('Browser crashed, herstarten over 3 sec...');
                this.cameras.clear();
                setTimeout(() => this.launchBrowser(), 3000);
            }
        });
    }

    async poll() {
        if (!this.running) return;

        try {
            const cmd = new GetObjectCommand({
                Bucket: this.config.r2.bucketName,
                Key: 'control.json',
            });
            const res = await this.s3.send(cmd);
            const body = await res.Body.transformToString();
            const control = JSON.parse(body);
            await this.sync(control);
        } catch (err) {
            if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
                if (this.cameras.size > 0) {
                    this.log('Geen verzoeken meer, cameras stoppen');
                    await this.stopAll();
                }
            } else if (this.config.debug) {
                this.log(`Poll: ${err.message}`);
            }
        }
    }

    async sync(control) {
        const maxLive = this.config.maxLiveCameras || 3;
        const wantedLive = (control.live || []).slice(0, maxLive);
        const wantedTimelapse = control.timelapse || [];

        const wanted = new Map();
        for (const c of wantedLive) wanted.set(c.id, { ...c, mode: 'live' });
        for (const c of wantedTimelapse) wanted.set(c.id, { ...c, mode: 'timelapse' });

        for (const [id, cam] of this.cameras) {
            if (!wanted.has(id) || wanted.get(id).mode !== cam.mode) {
                await this.stopCamera(id);
            }
        }

        for (const [id, spec] of wanted) {
            if (!this.cameras.has(id)) {
                await this.startCamera(spec);
            }
        }
    }

    async startCamera(spec) {
        const { id, rwsUrl, mode } = spec;
        this.log(`Camera ${id} starten (${mode}): ${rwsUrl}`);

        try {
            const page = await this.browser.newPage();
            await page.setViewport({ width: 1280, height: 720 });
            await page.setUserAgent(
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            );

            await page.goto(rwsUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            await this.dismissCookies(page);
            await this.sleep(2000);
            await this.tryStartStream(page);
            await this.sleep(3000);

            if (this.config.debug) {
                const debugPath = path.join(__dirname, `debug-cam-${id}.jpg`);
                await page.screenshot({ path: debugPath, type: 'jpeg', quality: 80 });
                this.log(`  Debug screenshot: ${debugPath}`);
            }

            const interval = mode === 'live'
                ? (this.config.captureInterval || 2000)
                : (this.config.timelapseInterval || 30000);

            await this.capture(id, page, mode);

            const timer = setInterval(() => this.capture(id, page, mode), interval);
            this.cameras.set(id, { page, mode, timer, rwsUrl });
            this.log(`Camera ${id} actief (elke ${interval / 1000}s)`);

        } catch (err) {
            this.log(`Camera ${id} mislukt: ${err.message}`);
        }
    }

    async dismissCookies(page) {
        const selectors = [
            'button[id*="accept"]', 'button[class*="accept"]',
            '.cookie-accept', '#cookie-accept',
            'button[data-action="accept"]', '.cc-btn.cc-allow',
            '[id*="consent"] button', '[class*="consent"] button',
        ];
        for (const sel of selectors) {
            try {
                const btn = await page.$(sel);
                if (btn && await btn.isIntersectingViewport()) {
                    await btn.click();
                    this.log('  Cookie banner geaccepteerd');
                    await this.sleep(500);
                    return;
                }
            } catch {}
        }
    }

    async tryStartStream(page) {
        const video = await page.$('video');
        if (video) {
            this.log('  Video al actief');
            return;
        }

        const playSelectors = [
            'button[class*="play"]', '.play-button', '.vjs-big-play-button',
            '[data-action="play"]', 'button[aria-label*="afspelen"]',
            'button[aria-label*="play" i]', '.player-overlay', '.video-play',
            'a[class*="stream"]', 'button[class*="stream"]', '.livestream-button',
        ];

        for (const sel of playSelectors) {
            try {
                const btn = await page.$(sel);
                if (btn && await btn.isIntersectingViewport()) {
                    await btn.click();
                    this.log(`  Klik op: ${sel}`);
                    await this.sleep(1500);

                    const v = await page.$('video');
                    if (v) {
                        this.log('  Video gestart!');
                        return;
                    }
                }
            } catch {}
        }

        this.log('  Geen video gevonden, screenshot van hele pagina');
    }

    async capture(id, page, mode) {
        try {
            let buf;

            const video = await page.$('video');
            if (video) {
                const box = await video.boundingBox();
                if (box && box.width > 50 && box.height > 50) {
                    buf = await video.screenshot({ type: 'jpeg', quality: 85 });
                }
            }

            if (!buf || buf.length < 2000) {
                const fallbackSelectors = [
                    '.camera-image', '.video-container', '.camera-container',
                    '.player', '.stream-container', 'main', '.content',
                ];
                for (const sel of fallbackSelectors) {
                    try {
                        const el = await page.$(sel);
                        if (el) {
                            const box = await el.boundingBox();
                            if (box && box.width > 100 && box.height > 50) {
                                buf = await el.screenshot({ type: 'jpeg', quality: 85 });
                                if (buf.length > 2000) break;
                            }
                        }
                    } catch {}
                }
            }

            if (!buf || buf.length < 2000) {
                buf = await page.screenshot({
                    type: 'jpeg', quality: 80,
                    clip: { x: 0, y: 0, width: 1280, height: 720 },
                });
            }

            if (!buf || buf.length < 1000) return;

            const key = mode === 'live'
                ? `live/${id}.jpg`
                : `timelapse/${id}/${this.timestamp()}.jpg`;

            await this.s3.send(new PutObjectCommand({
                Bucket: this.config.r2.bucketName,
                Key: key,
                Body: buf,
                ContentType: 'image/jpeg',
            }));

            if (this.config.debug) {
                this.log(`  ${mode} ${id}: ${(buf.length / 1024).toFixed(1)}KB`);
            }

        } catch (err) {
            if (this.config.debug) this.log(`  Capture fout ${id}: ${err.message}`);
        }
    }

    timestamp() {
        return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    }

    async stopCamera(id) {
        const cam = this.cameras.get(id);
        if (!cam) return;
        this.log(`Camera ${id} stoppen`);
        clearInterval(cam.timer);
        try { await cam.page.close(); } catch {}
        this.cameras.delete(id);
    }

    async stopAll() {
        for (const id of [...this.cameras.keys()]) {
            await this.stopCamera(id);
        }
    }

    async shutdown() {
        this.running = false;
        this.log('Afsluiten...');
        if (this.pollTimer) clearInterval(this.pollTimer);
        await this.stopAll();
        if (this.browser) {
            try { await this.browser.close(); } catch {}
        }
        this.log('Klaar');
    }

    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

const args = process.argv.slice(2);
const debugFlag = args.includes('--debug');
const configArg = args.find(a => !a.startsWith('--'));
const configPath = configArg || path.join(__dirname, 'config.json');

if (!fs.existsSync(configPath)) {
    console.error(`\nConfig niet gevonden: ${configPath}`);
    console.error('Kopieer config.example.json naar config.json en vul je gegevens in.\n');
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
if (debugFlag) config.debug = true;

const capture = new BrionicleCapture(config);

process.on('SIGINT', () => capture.shutdown().then(() => process.exit(0)));
process.on('SIGTERM', () => capture.shutdown().then(() => process.exit(0)));

capture.start().catch(err => {
    console.error('Start mislukt:', err);
    process.exit(1);
});
