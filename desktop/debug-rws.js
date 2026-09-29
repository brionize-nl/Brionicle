#!/usr/bin/env node
const puppeteer = require('puppeteer');

(async () => {
    const streamUrls = [];

    const b = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-popup-blocking', '--autoplay-policy=no-user-gesture-required']
    });
    const pg = await b.newPage();
    await pg.setViewport({ width: 1280, height: 720 });

    pg.on('request', req => {
        const url = req.url();
        if (url.match(/\.(m3u8|mpd|ts|mp4|flv|stream|video)/i) ||
            url.includes('inmoves') || url.includes('hls') ||
            url.includes('stream') || url.includes('manifest')) {
            streamUrls.push({ type: 'request', url, method: req.method() });
        }
    });

    pg.on('response', res => {
        const ct = res.headers()['content-type'] || '';
        if (ct.includes('mpegurl') || ct.includes('dash') || ct.includes('video')) {
            streamUrls.push({ type: 'response', url: res.url(), contentType: ct });
        }
    });

    console.log('Pagina laden...');
    await pg.goto('https://www.rwsverkeersinfo.nl/cameras/4/a1-amersfoort', {
        waitUntil: 'networkidle2', timeout: 30000
    });
    await new Promise(r => setTimeout(r, 3000));

    await pg.screenshot({ path: 'debug-1-loaded.jpg', type: 'jpeg', quality: 90 });
    console.log('Screenshot 1: pagina geladen');

    // Klik op "live stream" link
    const clicked = await pg.evaluate(() => {
        const els = [...document.querySelectorAll('a, button, [role="button"], [onclick]')];
        for (const el of els) {
            const text = (el.textContent || '').trim().toLowerCase();
            if (text.includes('livestream') || text.includes('live stream') || text.includes('live')) {
                if (el.offsetParent !== null) {
                    el.click();
                    return text.slice(0, 60);
                }
            }
        }
        return null;
    });
    console.log(clicked ? `Geklikt op: "${clicked}"` : 'Geen live stream link gevonden');

    // Popup afvangen
    const popupPromise = new Promise(resolve => {
        const handler = async (target) => {
            if (target.type() === 'page') {
                b.off('targetcreated', handler);
                resolve(await target.page());
            }
        };
        b.on('targetcreated', handler);
        setTimeout(() => { b.off('targetcreated', handler); resolve(null); }, 10000);
    });

    await new Promise(r => setTimeout(r, 5000));
    await pg.screenshot({ path: 'debug-2-after-click.jpg', type: 'jpeg', quality: 90 });
    console.log('Screenshot 2: na klik op live stream');

    const popup = await popupPromise;
    let capturePage = pg;

    if (popup) {
        console.log(`\n=== POPUP GEOPEND: ${popup.url()} ===`);
        capturePage = popup;

        popup.on('request', req => {
            const url = req.url();
            if (url.match(/\.(m3u8|mpd|ts|mp4|flv|stream|video)/i) ||
                url.includes('inmoves') || url.includes('hls') ||
                url.includes('stream') || url.includes('manifest')) {
                streamUrls.push({ type: 'popup-request', url, method: req.method() });
            }
        });

        await new Promise(r => setTimeout(r, 5000));
        await popup.screenshot({ path: 'debug-3-popup.jpg', type: 'jpeg', quality: 90 });
        console.log('Screenshot 3: popup pagina');
    }

    // Zoek het schuifje/toggle - alle elementen rond de video
    const toggles = await capturePage.evaluate(() => {
        const results = [];
        const selectors = [
            'input[type="range"]', 'input[type="checkbox"]',
            '[class*="toggle"]', '[class*="slider"]', '[class*="switch"]',
            '[class*="control"]', '[class*="play"]', '[class*="stream"]',
            '[role="slider"]', '[role="switch"]', '[role="checkbox"]',
            '[class*="schuif"]', '[class*="live"]',
            'label', '.btn', '[class*="btn"]'
        ];
        for (const sel of selectors) {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
                const r = el.getBoundingClientRect();
                if (r.width < 5 || r.height < 5) continue;
                results.push({
                    sel,
                    tag: el.tagName,
                    type: el.type || '',
                    cls: (el.className || '').toString().slice(0, 120),
                    id: el.id || '',
                    text: el.textContent.trim().slice(0, 60),
                    checked: el.checked,
                    value: (el.value || '').slice(0, 40),
                    x: Math.round(r.x),
                    y: Math.round(r.y),
                    w: Math.round(r.width),
                    h: Math.round(r.height)
                });
            }
        }
        return results;
    });

    if (toggles.length) {
        console.log(`\n=== ${toggles.length} TOGGLE/SLIDER ELEMENTEN ===`);
        toggles.forEach(t => {
            const info = [`${t.sel} → ${t.tag}`];
            if (t.id) info.push(`id=${t.id}`);
            if (t.cls) info.push(`class="${t.cls.slice(0, 80)}"`);
            if (t.text) info.push(`"${t.text.slice(0, 40)}"`);
            if (t.type) info.push(`type=${t.type}`);
            if (t.checked !== undefined && t.checked !== null) info.push(`checked=${t.checked}`);
            info.push(`@${t.x},${t.y} ${t.w}x${t.h}`);
            console.log(info.join(' | '));
        });
    }

    // Zoek video/iframe/canvas
    const media = await capturePage.evaluate(() => {
        return [...document.querySelectorAll('video, canvas, iframe, img[src*="stream"], img[src*="camera"], img[src*="video"]')].map(e => {
            const r = e.getBoundingClientRect();
            return {
                tag: e.tagName,
                src: (e.src || '').slice(0, 200),
                cls: (e.className || '').slice(0, 80),
                id: e.id || '',
                x: Math.round(r.x), y: Math.round(r.y),
                w: Math.round(r.width), h: Math.round(r.height),
                videoSrc: e.tagName === 'VIDEO' ? (e.currentSrc || '').slice(0, 200) : '',
            };
        }).filter(e => e.w > 30);
    });
    if (media.length) {
        console.log(`\n=== ${media.length} MEDIA ELEMENTEN ===`);
        media.forEach(m => console.log(JSON.stringify(m)));
    }

    // Toon ALLE gevonden stream URLs
    if (streamUrls.length) {
        console.log(`\n=== ${streamUrls.length} STREAM URLs GEVONDEN ===`);
        streamUrls.forEach(s => console.log(JSON.stringify(s)));
    } else {
        console.log('\n=== GEEN STREAM URLs GEVONDEN ===');
    }

    // Volledige HTML structuur rond video-achtig element
    const videoHtml = await capturePage.evaluate(() => {
        const v = document.querySelector('video') || document.querySelector('iframe') || document.querySelector('[class*="player"]');
        if (!v) return null;
        const parent = v.parentElement?.parentElement || v.parentElement;
        return parent ? parent.outerHTML.slice(0, 3000) : v.outerHTML.slice(0, 1000);
    });
    if (videoHtml) {
        console.log('\n=== HTML ROND VIDEO/PLAYER ===');
        console.log(videoHtml);
    }

    await b.close();
    console.log('\nKlaar! Check ook debug-1-loaded.jpg, debug-2-after-click.jpg en debug-3-popup.jpg');
})();
