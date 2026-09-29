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

        const streamUrl = cam.stream_url || cam.streamUrl || '';
        const staticUrl = cam.static_url || cam.staticUrl || '';
        const baseUrl = streamUrl.replace(/\/embed\/?$/, '');
        log.push({ stream_url: streamUrl, static_url: staticUrl, baseUrl });

        if (!baseUrl) {
            if (debug) return jsonResponse({ error: 'No stream URL in API', log });
            return jsonResponse({ error: 'No stream URL' }, 404);
        }

        // Haal embed pagina HTML op (nodig voor debug en stream zoeken)
        const embedUrl = streamUrl.includes('/embed') ? streamUrl : baseUrl + '/embed';
        let embedHtml = '';
        try {
            const embedRes = await fetch(embedUrl, { headers: UPSTREAM_HEADERS });
            embedHtml = await embedRes.text();
        } catch (e) {
            log.push({ embed_error: e.message });
        }

        // Haal ook common.js op — daar zit de stream-logica
        let commonJs = '';
        const commonMatch = embedHtml.match(/["'](https?:\/\/img\.inmoves\.nl\/js\/common\.js[^"']*)["']/);
        if (commonMatch) {
            try {
                const jsRes = await fetch(commonMatch[1], { headers: UPSTREAM_HEADERS });
                commonJs = await jsRes.text();
            } catch {}
        }

        if (debug) {
            log.push({ embedHtml, commonJsLen: commonJs.length, commonJsSnippet: commonJs.slice(0, 2000) });
        }

        // Zoek stream URLs in embed HTML + common.js
        const allSource = embedHtml + '\n' + commonJs;

        // Methode 1: Zoek m3u8 URLs
        const m3u8Pattern = /["'`]((?:https?:)?\/\/[^"'`\s]*\.m3u8[^"'`\s]*?)["'`]/gi;
        const m3u8Matches = [...allSource.matchAll(m3u8Pattern)].map(m => m[1])
            .filter(u => !u.includes('.min.js') && !u.includes('.min.css'));

        // Methode 2: Zoek video source patronen
        const srcPattern = /(?:src|source|file|stream|hls_url|video_url|streamUrl|hlsUrl)\s*[=:]\s*["'`]((?:https?:)?\/\/[^"'`\s]+)["'`]/gi;
        const srcMatches = [...allSource.matchAll(srcPattern)].map(m => m[1]);

        // Methode 3: loadSource / player.src patronen
        const hlsPattern = /(?:loadSource|\.src)\s*\(\s*(?:\{[^}]*(?:src|url)\s*:\s*)?["'`]([^"'`]+\.m3u8[^"'`]*)["'`]/gi;
        const hlsMatches = [...allSource.matchAll(hlsPattern)].map(m => m[1]);

        // Methode 4: Zoek in data-attributen
        const dataPattern = /data-(?:src|stream|url|hls|video)\s*=\s*["']([^"']+)["']/gi;
        const dataMatches = [...allSource.matchAll(dataPattern)].map(m => m[1]);

        // Methode 5: Zoek inmoves.nl paden die op stream/hls/live lijken
        const inmovesPattern = /["'`]((?:https?:)?\/\/[^"'`\s]*inmoves\.nl[^"'`\s]*(?:hls|live|stream|m3u8|video)[^"'`\s]*?)["'`]/gi;
        const inmovesMatches = [...allSource.matchAll(inmovesPattern)].map(m => m[1]);

        const allUrls = [...new Set([...m3u8Matches, ...srcMatches, ...hlsMatches, ...dataMatches, ...inmovesMatches])];
        log.push({ found_urls: allUrls });

        // Probeer elke gevonden URL
        for (let foundUrl of allUrls) {
            if (foundUrl.startsWith('//')) foundUrl = 'https:' + foundUrl;
            if (foundUrl.startsWith('/')) foundUrl = new URL(baseUrl).origin + foundUrl;

            // Skip JS/CSS libraries
            if (foundUrl.match(/\.(js|css)(\?|$)/)) continue;

            try {
                const res = await fetch(foundUrl, { headers: UPSTREAM_HEADERS });
                const body = await res.text();
                const isManifest = body.trimStart().startsWith('#EXTM3U');
                log.push({ try_url: foundUrl, status: res.status, isManifest, len: body.length });
                if (res.ok && isManifest) {
                    if (debug) return jsonResponse({ found: 'pattern_match', url: foundUrl, log });
                    return proxyManifest(body, foundUrl);
                }
            } catch (e) {
                log.push({ try_url: foundUrl, error: e.message });
            }
        }

        // Methode 6: Probeer bekende inmoves.nl stream paden
        const streamId = baseUrl.split('/').pop();
        const hlsPaths = [
            `https://stream.inmoves.nl/${streamId}/live/index.m3u8`,
            `https://stream.inmoves.nl/${streamId}/index.m3u8`,
            `https://stream.inmoves.nl/hls/${streamId}/index.m3u8`,
            `https://stream.inmoves.nl/live/${streamId}/index.m3u8`,
            `https://hls.inmoves.nl/${streamId}/index.m3u8`,
            `https://stream.inmoves.nl/${streamId}/stream.m3u8`,
            `https://stream.inmoves.nl/${streamId}/playlist.m3u8`,
        ];

        for (const testUrl of hlsPaths) {
            try {
                const res = await fetch(testUrl, { headers: UPSTREAM_HEADERS });
                const body = await res.text();
                const isManifest = body.trimStart().startsWith('#EXTM3U');
                log.push({ try_path: testUrl, status: res.status, isManifest });
                if (res.ok && isManifest) {
                    if (debug) return jsonResponse({ found: 'direct_path', url: testUrl, log });
                    return proxyManifest(body, testUrl);
                }
            } catch (e) {
                log.push({ try_path: testUrl, error: e.message });
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
