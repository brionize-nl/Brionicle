const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400'
};

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
    const bucket = context.env.LIVE_BUCKET;
    if (!bucket) {
        return new Response(JSON.stringify({ error: 'R2 niet geconfigureerd' }), {
            status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    const frame = url.searchParams.get('frame');
    const action = url.searchParams.get('action') || 'frame';

    if (!id || !/^\d+$/.test(id)) {
        return new Response('Ongeldig camera id', { status: 400, headers: CORS_HEADERS });
    }

    if (action === 'list') {
        try {
            const list = await bucket.list({ prefix: `timelapse/${id}/`, limit: 1000 });
            const frames = list.objects
                .map(obj => ({
                    key: obj.key,
                    timestamp: obj.key.split('/').pop().replace('.jpg', '').replace(/-/g, (m, i) => i === 10 ? 'T' : i > 10 ? ':' : '-'),
                    size: obj.size,
                    uploaded: obj.uploaded?.toISOString()
                }))
                .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

            return new Response(JSON.stringify({ frames, count: frames.length }), {
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), {
                status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }
    }

    if (frame) {
        try {
            const obj = await bucket.get(`timelapse/${id}/${frame}.jpg`);
            if (!obj) {
                return new Response('Frame niet gevonden', { status: 404, headers: CORS_HEADERS });
            }
            return new Response(obj.body, {
                headers: { ...CORS_HEADERS, 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' }
            });
        } catch (err) {
            return new Response(err.message, { status: 500, headers: CORS_HEADERS });
        }
    }

    return new Response('Gebruik ?action=list of ?frame=TIMESTAMP', {
        status: 400, headers: CORS_HEADERS
    });
}
