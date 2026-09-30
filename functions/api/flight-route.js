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
    const callsign = (url.searchParams.get('callsign') || '').trim().toUpperCase();

    if (!callsign || !/^[A-Z0-9]{2,8}$/.test(callsign)) {
        return new Response(JSON.stringify({ error: 'Invalid callsign' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    try {
        const res = await fetch(`https://api.adsbdb.com/v0/callsign/${callsign}`, {
            headers: { 'User-Agent': 'Brionicle/1.0' }
        });

        const data = await res.text();
        return new Response(data, {
            status: res.status,
            headers: {
                ...CORS_HEADERS,
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300'
            }
        });
    } catch {
        return new Response(JSON.stringify({ error: 'Route API unreachable' }), {
            status: 502,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }
}
