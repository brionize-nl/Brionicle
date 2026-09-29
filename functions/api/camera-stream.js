const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400'
};

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet() {
    return new Response(JSON.stringify({ error: 'HLS streaming niet beschikbaar. Gebruik /api/camera-live voor desktop captures.' }), {
        status: 410,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
}
