const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400'
};

const UPSTREAM_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://www.rwsverkeersinfo.nl/'
};

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    const path = url.searchParams.get('path');

    if (path) {
        return proxySegment(path);
    }

    if (!id || !/^\d+$/.test(id)) {
        return new Response('Missing or invalid camera id', { status: 400, headers: CORS_HEADERS });
    }

    try {
        const apiRes = await fetch('https://api.rwsverkeersinfo.nl/api/cameras', {
            headers: UPSTREAM_HEADERS
        });
        if (!apiRes.ok) throw new Error('RWS API ' + apiRes.status);
        const cameras = await apiRes.json();
        const cam = cameras.find(c => String(c.id) === id);
        if (!cam) {
            return new Response(JSON.stringify({ error: 'Camera not found' }), {
                status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        const streamUrl = cam.stream_url || cam.streamUrl || '';
        const baseUrl = streamUrl.replace(/\/embed\/?$/, '');
        if (!baseUrl) {
            return new Response(JSON.stringify({ error: 'No stream URL' }), {
                status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        const embedUrl = streamUrl.includes('/embed') ? streamUrl : baseUrl + '/embed';
        const embedRes = await fetch(embedUrl, { headers: UPSTREAM_HEADERS });
        if (!embedRes.ok) throw new Error('Embed page ' + embedRes.status);
        const html = await embedRes.text();

        const m3u8Matches = html.match(/["'](https?:\/\/[^"']*\.m3u8[^"']*?)["']/gi)
            || html.match(/["']([^"']*\.m3u8[^"']*?)["']/gi);

        if (m3u8Matches && m3u8Matches.length > 0) {
            let m3u8Url = m3u8Matches[0].replace(/^["']|["']$/g, '');
            if (m3u8Url.startsWith('/')) {
                const origin = new URL(baseUrl).origin;
                m3u8Url = origin + m3u8Url;
            } else if (!m3u8Url.startsWith('http')) {
                m3u8Url = baseUrl + '/' + m3u8Url;
            }

            const m3u8Res = await fetch(m3u8Url, { headers: UPSTREAM_HEADERS });
            if (m3u8Res.ok) {
                let manifest = await m3u8Res.text();
                const m3u8Base = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
                manifest = manifest.replace(/^(?!#)(\S+\.(?:m3u8|ts|m4s|mp4)\S*)/gm, (match) => {
                    if (match.startsWith('http')) return `/api/camera-stream?path=${encodeURIComponent(match)}`;
                    return `/api/camera-stream?path=${encodeURIComponent(m3u8Base + match)}`;
                });

                return new Response(manifest, {
                    headers: {
                        ...CORS_HEADERS,
                        'Content-Type': 'application/vnd.apple.mpegurl',
                        'Cache-Control': 'no-cache'
                    }
                });
            }
        }

        return new Response(JSON.stringify({
            embedUrl: embedUrl,
            streamBase: baseUrl
        }), {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }
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
