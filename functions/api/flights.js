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
    const lat = parseFloat(url.searchParams.get('lat'));
    const lon = parseFloat(url.searchParams.get('lon'));
    const dist = Math.max(1, Math.min(250, parseInt(url.searchParams.get('dist'), 10) || 100));

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return new Response(JSON.stringify({ error: 'lat and lon required' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    try {
        const apiUrl = `https://api.adsb.lol/v2/lat/${lat.toFixed(4)}/lon/${lon.toFixed(4)}/dist/${dist}`;
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
