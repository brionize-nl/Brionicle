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
        return new Response('R2 niet geconfigureerd', { status: 503, headers: CORS_HEADERS });
    }

    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');

    if (!id || !/^\d+$/.test(id)) {
        return new Response('Ongeldig camera id', { status: 400, headers: CORS_HEADERS });
    }

    try {
        const obj = await bucket.get(`live/${id}.jpg`);
        if (!obj) {
            return new Response('Geen live beeld', { status: 404, headers: CORS_HEADERS });
        }

        const headers = new Headers(CORS_HEADERS);
        headers.set('Content-Type', 'image/jpeg');
        headers.set('Cache-Control', 'no-cache, no-store');
        headers.set('X-Live-Updated', obj.uploaded?.toISOString() || '');

        return new Response(obj.body, { headers });
    } catch (err) {
        return new Response(err.message, { status: 500, headers: CORS_HEADERS });
    }
}
