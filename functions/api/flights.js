const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
};

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');
    const dist = url.searchParams.get('dist') || '100';

    if (!lat || !lon) {
        return new Response(JSON.stringify({ error: 'lat and lon required' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    try {
        const apiUrl = `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${dist}`;
        const response = await fetch(apiUrl, {
            headers: { 'User-Agent': 'Brionicle/1.0' }
        });

        const data = await response.text();
        return new Response(data, {
            status: response.status,
            headers: {
                ...CORS_HEADERS,
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=5'
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'API unreachable' }), {
            status: 502,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }
}
