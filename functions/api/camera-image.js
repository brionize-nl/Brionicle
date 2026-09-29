const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400'
};

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');

    if (!id || !/^\d+$/.test(id)) {
        return new Response('Missing or invalid camera id', {
            status: 400,
            headers: CORS_HEADERS
        });
    }

    try {
        const apiRes = await fetch('https://api.rwsverkeersinfo.nl/api/cameras', {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Brionicle/1.0)' }
        });
        if (!apiRes.ok) throw new Error('RWS API ' + apiRes.status);
        const cameras = await apiRes.json();
        const cam = cameras.find(c => String(c.id) === id);

        if (!cam) {
            return new Response(JSON.stringify({ error: 'Camera not found' }), {
                status: 404,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        const staticUrl = cam.static_url || cam.staticUrl;
        if (staticUrl && staticUrl.includes('stream.inmoves.nl')) {
            const imgRes = await fetch(staticUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Brionicle/1.0)',
                    'Referer': 'https://www.rwsverkeersinfo.nl/'
                }
            });
            const ct = imgRes.headers.get('content-type') || '';
            if (imgRes.ok && ct.startsWith('image/')) {
                const body = await imgRes.arrayBuffer();
                if (body.byteLength > 2000) {
                    return new Response(body, {
                        headers: {
                            ...CORS_HEADERS,
                            'Content-Type': ct,
                            'Cache-Control': 'public, max-age=3'
                        }
                    });
                }
            }
        }

        const streamUrl = cam.stream_url || cam.streamUrl;
        if (streamUrl && streamUrl.includes('stream.inmoves.nl')) {
            const baseUrl = streamUrl.replace(/\/embed\/?$/, '');
            const imgRes = await fetch(baseUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Brionicle/1.0)',
                    'Referer': 'https://www.rwsverkeersinfo.nl/'
                }
            });
            const ct = imgRes.headers.get('content-type') || '';
            if (imgRes.ok && ct.startsWith('image/')) {
                const body = await imgRes.arrayBuffer();
                if (body.byteLength > 2000) {
                    return new Response(body, {
                        headers: {
                            ...CORS_HEADERS,
                            'Content-Type': ct,
                            'Cache-Control': 'public, max-age=3'
                        }
                    });
                }
            }
        }
    } catch {}

    return new Response(JSON.stringify({ error: 'No camera image found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
}
