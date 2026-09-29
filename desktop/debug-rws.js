#!/usr/bin/env node
const puppeteer = require('puppeteer');

(async () => {
    const b = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-popup-blocking']
    });
    const pg = await b.newPage();
    await pg.setViewport({ width: 1280, height: 720 });

    console.log('Pagina laden...');
    await pg.goto('https://www.rwsverkeersinfo.nl/cameras/4/a1-amersfoort', {
        waitUntil: 'networkidle2', timeout: 30000
    });
    await new Promise(r => setTimeout(r, 5000));

    await pg.screenshot({ path: 'debug-1-loaded.jpg', type: 'jpeg', quality: 90 });
    console.log('Screenshot 1: pagina geladen');

    // Zoek ALLE klikbare elementen
    const clickables = await pg.evaluate(() => {
        const els = document.querySelectorAll('a, button, input, select, [onclick], [role], label, div[class], span[class]');
        return [...els].map(e => {
            const r = e.getBoundingClientRect();
            if (r.width < 5 || r.height < 5) return null;
            return {
                tag: e.tagName,
                type: e.type || '',
                cls: (e.className || '').toString().slice(0, 100),
                id: e.id || '',
                role: e.getAttribute('role') || '',
                text: e.textContent.trim().slice(0, 60),
                href: e.href || '',
                title: e.title || '',
                ariaLabel: e.getAttribute('aria-label') || '',
                x: Math.round(r.x),
                y: Math.round(r.y),
                w: Math.round(r.width),
                h: Math.round(r.height)
            };
        }).filter(Boolean);
    });

    console.log(`\n=== ${clickables.length} KLIKBARE ELEMENTEN ===\n`);
    clickables.forEach(e => {
        const info = [e.tag];
        if (e.type) info.push(`type=${e.type}`);
        if (e.role) info.push(`role=${e.role}`);
        if (e.id) info.push(`id=${e.id}`);
        if (e.cls) info.push(`class="${e.cls.slice(0, 60)}"`);
        if (e.text) info.push(`"${e.text.slice(0, 40)}"`);
        if (e.href) info.push(`href=${e.href.slice(0, 60)}`);
        if (e.title) info.push(`title="${e.title}"`);
        if (e.ariaLabel) info.push(`aria="${e.ariaLabel}"`);
        info.push(`@${e.x},${e.y} ${e.w}x${e.h}`);
        console.log(info.join(' | '));
    });

    // Zoek iframes
    const iframes = await pg.evaluate(() => {
        return [...document.querySelectorAll('iframe')].map(f => ({
            src: f.src, w: f.width, h: f.height,
            cls: f.className, id: f.id
        }));
    });
    if (iframes.length) {
        console.log(`\n=== ${iframes.length} IFRAMES ===`);
        iframes.forEach(f => console.log(JSON.stringify(f)));
    }

    // Zoek video/canvas/img elementen
    const media = await pg.evaluate(() => {
        return [...document.querySelectorAll('video, canvas, img')].map(e => {
            const r = e.getBoundingClientRect();
            return {
                tag: e.tagName, src: (e.src || '').slice(0, 100),
                cls: (e.className || '').slice(0, 60),
                x: Math.round(r.x), y: Math.round(r.y),
                w: Math.round(r.width), h: Math.round(r.height)
            };
        }).filter(e => e.w > 50);
    });
    if (media.length) {
        console.log(`\n=== ${media.length} MEDIA ELEMENTEN ===`);
        media.forEach(m => console.log(`${m.tag} ${m.w}x${m.h} @${m.x},${m.y} src=${m.src} cls=${m.cls}`));
    }

    await b.close();
    console.log('\nKlaar!');
})();
