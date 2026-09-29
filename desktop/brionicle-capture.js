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
        this._starting = new Set();
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
                '--disable-popup-blocking',
            ],
            ...(this.config.chromePath ? { executablePath: this.config.chromePath } : {}),
        });

        this.browser.on('disconnected', () => {
            if (this.running) {
                this.log('Browser crashed, herstarten over 3 sec...');
                this.cameras.clear();
                this._starting.clear();
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
            if (!this.cameras.has(id) && !this._starting.has(id)) {
                this.startCamera(spec);
            }
        }
    }

    async startCamera(spec) {
        const { id, rwsUrl, mode } = spec;

        this._starting.add(id);
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

            // Stap 1: Klik het "Live stream" schuifje aan
            const toggled = await this.clickLiveToggle(page);
            if (toggled) {
                this.log(`  Live stream toggle aangeklikt (${toggled})`);
                await this.sleep(3000);
            } else {
                this.log('  Geen live stream toggle gevonden');
            }

            // Stap 2: Maak video/iframe fullscreen (vult heel het venster)
            const madeFullscreen = await this.makeVideoFullscreen(page);
            if (madeFullscreen) {
                this.log(`  Fullscreen: ${madeFullscreen}`);
                await this.sleep(1000);
            }

            if (this.config.debug) {
                const debugPath = path.join(__dirname, `debug-cam-${id}.jpg`);
                await page.screenshot({ path: debugPath, type: 'jpeg', quality: 80 });
                this.log(`  Debug screenshot: ${debugPath}`);
            }

            const interval = mode === 'live'
                ? (this.config.captureInterval || 2000)
                : (this.config.timelapseInterval || 30000);

            const cam = { page, capturePage: page, mode, timer: null, rwsUrl, stopped: false };
            this.cameras.set(id, cam);

            await this.capture(id);

            cam.timer = setInterval(() => {
                if (!cam.stopped) this.capture(id);
            }, interval);

            this.log(`Camera ${id} actief (elke ${interval / 1000}s)`);

        } catch (err) {
            this.log(`Camera ${id} mislukt: ${err.message}`);
        } finally {
            this._starting.delete(id);
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

    async clickLiveToggle(page) {
        try {
            const clicked = await page.evaluate(() => {
                // Zoek het "Live stream" toggle schuifje op de RWS pagina
                // Het is een toggle/switch element naast de tekst "Live stream"

                // Methode 1: Zoek input[type=checkbox] bij "live stream" label
                const labels = [...document.querySelectorAll('label')];
                for (const label of labels) {
                    const text = (label.textContent || '').toLowerCase();
                    if (text.includes('live stream') || text.includes('livestream')) {
                        const input = label.querySelector('input') || document.getElementById(label.htmlFor);
                        if (input && !input.checked) {
                            input.click();
                            return 'label-input';
                        }
                        label.click();
                        return 'label';
                    }
                }

                // Methode 2: Zoek toggle/switch elementen
                const toggleSelectors = [
                    '[class*="toggle"][class*="stream"]',
                    '[class*="toggle"][class*="live"]',
                    '[class*="switch"][class*="stream"]',
                    '[class*="switch"][class*="live"]',
                    'input[type="checkbox"][id*="live"]',
                    'input[type="checkbox"][id*="stream"]',
                    'input[type="checkbox"][name*="live"]',
                    '[role="switch"]',
                    '[role="checkbox"]',
                ];
                for (const sel of toggleSelectors) {
                    const el = document.querySelector(sel);
                    if (el && el.offsetParent !== null) {
                        el.click();
                        return 'selector: ' + sel;
                    }
                }

                // Methode 3: Zoek elke klikbare element met "live stream" tekst
                const clickables = [...document.querySelectorAll('a, button, span, div, label, input')];
                for (const el of clickables) {
                    const text = (el.textContent || '').trim().toLowerCase();
                    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                    if ((text === 'live stream' || text === 'livestream' || ariaLabel.includes('live stream'))
                        && el.offsetParent !== null) {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 5 && rect.height > 5 && rect.width < 300) {
                            el.click();
                            return 'text-match: ' + text.slice(0, 30);
                        }
                    }
                }

                return null;
            });
            return clicked;
        } catch {
            return null;
        }
    }

    async makeVideoFullscreen(page) {
        try {
            return await page.evaluate(() => {
                const fullscreenStyle = 'position:fixed!important;top:0!important;left:0!important;width:100vw!important;height:100vh!important;z-index:999999!important;object-fit:contain!important;background:#000!important;';

                // Methode 1: Video element direct fullscreen
                const video = document.querySelector('video');
                if (video && video.offsetWidth > 50) {
                    video.style.cssText = fullscreenStyle;
                    video.muted = true;
                    video.play().catch(() => {});
                    return 'video';
                }

                // Methode 2: Inmoves.nl iframe fullscreen
                const iframes = [...document.querySelectorAll('iframe')];
                for (const iframe of iframes) {
                    const src = iframe.src || '';
                    if (src.includes('inmoves') || src.includes('stream') || src.includes('video')) {
                        iframe.style.cssText = fullscreenStyle;
                        return 'iframe: ' + src.slice(0, 60);
                    }
                }

                // Methode 3: Grootste iframe/video container fullscreen
                const bigIframe = iframes.reduce((best, f) => {
                    const r = f.getBoundingClientRect();
                    const area = r.width * r.height;
                    return area > (best ? best.area : 0) ? { el: f, area } : best;
                }, null);
                if (bigIframe && bigIframe.area > 10000) {
                    bigIframe.el.style.cssText = fullscreenStyle;
                    return 'biggest-iframe';
                }

                // Methode 4: Grootste img (snapshot) fullscreen als fallback
                const imgs = [...document.querySelectorAll('img')];
                const bigImg = imgs.reduce((best, img) => {
                    const r = img.getBoundingClientRect();
                    const area = r.width * r.height;
                    return area > (best ? best.area : 0) ? { el: img, area } : best;
                }, null);
                if (bigImg && bigImg.area > 30000) {
                    bigImg.el.style.cssText = fullscreenStyle;
                    return 'img';
                }

                return null;
            });
        } catch {
            return null;
        }
    }

    async findStreamIframe(page) {
        try {
            const iframes = await page.$$('iframe');
            for (const iframe of iframes) {
                const src = await iframe.evaluate(el => el.src || '');
                if (src && (src.includes('inmoves') || src.includes('stream') || src.includes('video'))) {
                    return iframe;
                }
            }
        } catch {}
        return null;
    }

    async clickByText(page, textMatches) {
        try {
            const result = await page.evaluate((texts) => {
                const els = [...document.querySelectorAll('a, button, [role="button"], [onclick]')];
                for (const text of texts) {
                    for (const el of els) {
                        const content = (el.textContent || '').trim().toLowerCase();
                        if (content.includes(text) && el.offsetParent !== null) {
                            el.click();
                            return content.slice(0, 40);
                        }
                    }
                }
                return null;
            }, textMatches);
            return result;
        } catch {
            return null;
        }
    }

    async capture(id) {
        const cam = this.cameras.get(id);
        if (!cam || cam.stopped) return;

        try {
            const capturePage = cam.capturePage;
            let buf;

            const video = await capturePage.$('video');
            if (video) {
                const box = await video.boundingBox();
                if (box && box.width > 50 && box.height > 50) {
                    buf = await video.screenshot({ type: 'jpeg', quality: 85 });
                }
            }

            if (!buf || buf.length < 2000) {
                const iframes = await capturePage.$$('iframe');
                for (const iframe of iframes) {
                    try {
                        const frame = await iframe.contentFrame();
                        if (frame) {
                            const fVideo = await frame.$('video');
                            if (fVideo) {
                                buf = await iframe.screenshot({ type: 'jpeg', quality: 85 });
                                if (buf && buf.length > 2000) break;
                            }
                            const fImg = await frame.$('img');
                            if (fImg) {
                                const box = await fImg.boundingBox();
                                if (box && box.width > 200 && box.height > 100) {
                                    buf = await fImg.screenshot({ type: 'jpeg', quality: 85 });
                                    if (buf && buf.length > 2000) break;
                                }
                            }
                        }
                    } catch {}
                }
            }

            if (!buf || buf.length < 2000) {
                const img = await capturePage.$('img[src*="stream"], img[src*="camera"], img[src*="inmoves"], img[src*="video"]');
                if (img) {
                    const box = await img.boundingBox();
                    if (box && box.width > 200 && box.height > 100) {
                        buf = await img.screenshot({ type: 'jpeg', quality: 85 });
                    }
                }
            }

            if (!buf || buf.length < 2000) {
                buf = await capturePage.screenshot({
                    type: 'jpeg', quality: 80,
                    clip: { x: 0, y: 0, width: 1280, height: 720 },
                });
            }

            if (!buf || buf.length < 1000) return;

            const key = cam.mode === 'live'
                ? `live/${id}.jpg`
                : `timelapse/${id}/${this.timestamp()}.jpg`;

            await this.s3.send(new PutObjectCommand({
                Bucket: this.config.r2.bucketName,
                Key: key,
                Body: buf,
                ContentType: 'image/jpeg',
            }));

            if (this.config.debug) {
                this.log(`  ${cam.mode} ${id}: ${(buf.length / 1024).toFixed(1)}KB`);
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
        cam.stopped = true;
        if (cam.timer) clearInterval(cam.timer);
        try { if (cam.popupPage) await cam.popupPage.close(); } catch {}
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
