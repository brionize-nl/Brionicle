const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400'
};

const ALLOWED_HOSTS = [
    'stream.inmoves.nl', 'www.inmoves.nl',
    'hd-auth.skylinewebcams.com', 'live-auth.skylinewebcams.com',
    'hd.skylinewebcams.com', 'live.skylinewebcams.com',
    'cdn.skylinewebcams.com'
];

function isAllowedUrl(urlStr) {
    try {
        const u = new URL(urlStr);
        return ALLOWED_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
    } catch {
        return false;
    }
}

function rewriteManifest(text, baseUrl, camId, origin) {
    return text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        if (trimmed.startsWith('#')) {
            if (trimmed.includes('URI="')) {
                return trimmed.replace(/URI="([^"]+)"/g, (_, uri) => {
                    const abs = uri.startsWith('http') ? uri : baseUrl + uri;
                    return `URI="${origin}/api/camera-stream?id=${camId}&seg=${encodeURIComponent(abs)}"`;
                });
            }
            return line;
        }

        const abs = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
        return `${origin}/api/camera-stream?id=${camId}&seg=${encodeURIComponent(abs)}`;
    }).join('\n');
}

function proxyHeaders(targetUrl) {
    const base = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' };
    if (targetUrl.includes('skylinewebcams.com')) {
        base['Referer'] = 'https://www.skylinewebcams.com/';
        base['Origin'] = 'https://www.skylinewebcams.com';
    } else {
        base['Referer'] = 'https://www.rwsverkeersinfo.nl/';
    }
    return base;
}

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
    const bucket = context.env.LIVE_BUCKET;
    if (!bucket) {
        return new Response('R2 niet geconfigureerd', { status: 503, headers: CORS_HEADERS });
    }

    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    const seg = url.searchParams.get('seg');

    if (!id || !/^[a-z0-9-]+$/.test(id)) {
        return new Response('Ongeldig camera id', { status: 400, headers: CORS_HEADERS });
    }

    if (seg) {
        if (!isAllowedUrl(seg)) {
            return new Response('Ongeldig segment URL', { status: 403, headers: CORS_HEADERS });
        }
        return proxySegment(seg, id, url.origin);
    }

    try {
        const obj = await bucket.get(`streams/${id}.json`);
        if (!obj) {
            return new Response(JSON.stringify({ error: 'Geen stream beschikbaar' }), {
                status: 404,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        const data = JSON.parse(await obj.text());
        if (!data.url || !isAllowedUrl(data.url)) {
            return new Response(JSON.stringify({ error: 'Ongeldige stream URL' }), {
                status: 404,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        return proxyManifest(data.url, id, url.origin);
    } catch {
        return new Response(JSON.stringify({ error: 'Stream fout' }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }
}

async function proxyManifest(m3u8Url, camId, origin) {
    const res = await fetch(m3u8Url, { headers: proxyHeaders(m3u8Url) });
    if (!res.ok) {
        return new Response('Stream niet bereikbaar', { status: 502, headers: CORS_HEADERS });
    }

    const text = await res.text();
    const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
    const rewritten = rewriteManifest(text, baseUrl, camId, origin);

    return new Response(rewritten, {
        headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'no-cache, no-store'
        }
    });
}

async function proxySegment(segUrl, camId, origin) {
    const res = await fetch(segUrl, { headers: proxyHeaders(segUrl) });
    if (!res.ok) {
        return new Response('Segment niet bereikbaar', { status: 502, headers: CORS_HEADERS });
    }

    const ct = res.headers.get('content-type') || 'video/mp2t';

    if (segUrl.endsWith('.m3u8') || ct.includes('mpegurl')) {
        const text = await res.text();
        const baseUrl = segUrl.substring(0, segUrl.lastIndexOf('/') + 1);
        const rewritten = rewriteManifest(text, baseUrl, camId, origin);

        return new Response(rewritten, {
            headers: {
                ...CORS_HEADERS,
                'Content-Type': 'application/vnd.apple.mpegurl',
                'Cache-Control': 'no-cache, no-store'
            }
        });
    }

    return new Response(res.body, {
        headers: {
            ...CORS_HEADERS,
            'Content-Type': ct,
            'Cache-Control': 'no-cache, no-store'
        }
    });
}
