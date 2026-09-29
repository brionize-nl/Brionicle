const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400'
};

const UPSTREAM_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': 'https://www.rwsverkeersinfo.nl/'
};

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    const path = url.searchParams.get('path');
    const debug = url.searchParams.get('debug');

    if (path) {
        return proxySegment(path);
    }

    if (!id || !/^\d+$/.test(id)) {
        return new Response('Missing or invalid camera id', { status: 400, headers: CORS_HEADERS });
    }

    const log = [];

    try {
        const apiRes = await fetch('https://api.rwsverkeersinfo.nl/api/cameras', {
            headers: UPSTREAM_HEADERS
        });
        if (!apiRes.ok) throw new Error('RWS API ' + apiRes.status);
        const cameras = await apiRes.json();
        const cam = cameras.find(c => String(c.id) === id);
        if (!cam) {
            return jsonResponse({ error: 'Camera not found' }, 404);
        }

        log.push({ cam_keys: Object.keys(cam), stream_url: cam.stream_url || cam.streamUrl, static_url: cam.static_url || cam.staticUrl });

        const streamUrl = cam.stream_url || cam.streamUrl || '';
        const baseUrl = streamUrl.replace(/\/embed\/?$/, '');

        if (!baseUrl) {
            if (debug) return jsonResponse({ error: 'No stream URL in API', log });
            return jsonResponse({ error: 'No stream URL' }, 404);
        }

        // Stap 1: Probeer directe HLS paden op de stream base URL
        const hlsPaths = [
            '/live/index.m3u8',
            '/index.m3u8',
            '/stream.m3u8',
            '/live.m3u8',
            '/playlist.m3u8',
            '/manifest.m3u8',
        ];

        for (const hlsPath of hlsPaths) {
            try {
                const testUrl = baseUrl + hlsPath;
                const res = await fetch(testUrl, { headers: UPSTREAM_HEADERS });
                const body = await res.text();
                log.push({ try: testUrl, status: res.status, isM3u8: body.includes('#EXTM3U'), len: body.length });
                if (res.ok && body.includes('#EXTM3U')) {
                    if (debug) return jsonResponse({ found: 'direct_path', url: testUrl, log });
                    return proxyManifest(body, testUrl);
                }
            } catch (e) {
                log.push({ try: baseUrl + hlsPath, error: e.message });
            }
        }

        // Stap 2: Haal embed pagina op en zoek in HTML + JavaScript
        const embedUrl = streamUrl.includes('/embed') ? streamUrl : baseUrl + '/embed';
        let html = '';
        try {
            const embedRes = await fetch(embedUrl, { headers: UPSTREAM_HEADERS });
            html = await embedRes.text();
            log.push({ embed: embedUrl, status: embedRes.status, htmlLen: html.length });
        } catch (e) {
            log.push({ embed: embedUrl, error: e.message });
        }

        if (html) {
            // Zoek m3u8 URLs in HTML/JS
            const m3u8Pattern = /["'`]((?:https?:)?\/\/[^"'`\s]*\.m3u8[^"'`\s]*?)["'`]/gi;
            const m3u8Matches = [...html.matchAll(m3u8Pattern)].map(m => m[1]);

            // Zoek ook in src/source attributen
            const srcPattern = /(?:src|source|url|file|stream)\s*[=:]\s*["'`]((?:https?:)?\/\/[^"'`\s]+)["'`]/gi;
            const srcMatches = [...html.matchAll(srcPattern)].map(m => m[1]);

            // Zoek HLS.loadSource of soortgelijk
            const hlsPattern = /loadSource\s*\(\s*["'`]([^"'`]+)["'`]/gi;
            const hlsMatches = [...html.matchAll(hlsPattern)].map(m => m[1]);

            const allUrls = [...new Set([...m3u8Matches, ...srcMatches, ...hlsMatches])];
            log.push({ found_urls: allUrls });

            for (let foundUrl of allUrls) {
                if (foundUrl.startsWith('//')) foundUrl = 'https:' + foundUrl;
                if (foundUrl.startsWith('/')) foundUrl = new URL(baseUrl).origin + foundUrl;
                if (!foundUrl.startsWith('http')) foundUrl = baseUrl + '/' + foundUrl;

                if (foundUrl.includes('.m3u8') || foundUrl.includes('stream') || foundUrl.includes('live') || foundUrl.includes('video')) {
                    try {
                        const res = await fetch(foundUrl, { headers: UPSTREAM_HEADERS });
                        const body = await res.text();
                        log.push({ try_embed_url: foundUrl, status: res.status, isM3u8: body.includes('#EXTM3U') });
                        if (res.ok && body.includes('#EXTM3U')) {
                            if (debug) return jsonResponse({ found: 'embed_html', url: foundUrl, log });
                            return proxyManifest(body, foundUrl);
                        }
                    } catch (e) {
                        log.push({ try_embed_url: foundUrl, error: e.message });
                    }
                }
            }

            // Stap 3: Zoek iframe src in embed pagina (dubbel embedded)
            const iframePattern = /<iframe[^>]+src=["']([^"']+)["']/gi;
            const iframeMatches = [...html.matchAll(iframePattern)].map(m => m[1]);
            log.push({ iframes: iframeMatches });

            for (let iframeSrc of iframeMatches) {
                if (iframeSrc.startsWith('//')) iframeSrc = 'https:' + iframeSrc;
                if (iframeSrc.startsWith('/')) iframeSrc = new URL(baseUrl).origin + iframeSrc;

                try {
                    const iframeRes = await fetch(iframeSrc, { headers: UPSTREAM_HEADERS });
                    const iframeHtml = await iframeRes.text();
                    const innerM3u8 = [...iframeHtml.matchAll(m3u8Pattern)].map(m => m[1]);
                    const innerSrc = [...iframeHtml.matchAll(srcPattern)].map(m => m[1]);
                    const innerHls = [...iframeHtml.matchAll(hlsPattern)].map(m => m[1]);
                    const innerUrls = [...new Set([...innerM3u8, ...innerSrc, ...innerHls])];
                    log.push({ iframe: iframeSrc, found_urls: innerUrls });

                    for (let innerUrl of innerUrls) {
                        if (innerUrl.startsWith('//')) innerUrl = 'https:' + innerUrl;
                        if (innerUrl.startsWith('/')) innerUrl = new URL(iframeSrc).origin + innerUrl;

                        try {
                            const res = await fetch(innerUrl, { headers: UPSTREAM_HEADERS });
                            const body = await res.text();
                            if (res.ok && body.includes('#EXTM3U')) {
                                if (debug) return jsonResponse({ found: 'iframe', url: innerUrl, log });
                                return proxyManifest(body, innerUrl);
                            }
                        } catch {}
                    }
                } catch (e) {
                    log.push({ iframe_error: e.message });
                }
            }
        }

        if (debug) return jsonResponse({ error: 'Geen HLS stream gevonden', log });

        return jsonResponse({ error: 'No HLS stream found' }, 404);

    } catch (e) {
        if (debug) return jsonResponse({ error: e.message, log });
        return jsonResponse({ error: e.message }, 502);
    }
}

function proxyManifest(manifest, sourceUrl) {
    const base = sourceUrl.substring(0, sourceUrl.lastIndexOf('/') + 1);
    const rewritten = manifest.replace(/^(?!#)(\S+)/gm, (match) => {
        if (!match.trim()) return match;
        const fullUrl = match.startsWith('http') ? match : base + match;
        return `/api/camera-stream?path=${encodeURIComponent(fullUrl)}`;
    });

    return new Response(rewritten, {
        headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'no-cache'
        }
    });
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
}

async function proxySegment(path) {
    try {
        const res = await fetch(path, { headers: UPSTREAM_HEADERS });
        if (!res.ok) {
            return new Response('Segment not found', { status: res.status, headers: CORS_HEADERS });
        }
        const ct = res.headers.get('content-type') || 'application/octet-stream';
        return new Response(res.body, {
            headers: {
                ...CORS_HEADERS,
                'Content-Type': ct,
                'Cache-Control': 'public, max-age=2'
            }
        });
    } catch {
        return new Response('Proxy error', { status: 502, headers: CORS_HEADERS });
    }
}
