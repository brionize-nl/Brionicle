const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
};

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet() {
    try {
        const response = await fetch('https://api.rwsverkeersinfo.nl/api/cameras', {
            headers: { 'User-Agent': 'Brionicle/1.0' }
        });

        const data = await response.text();
        return new Response(data, {
            status: response.status,
            headers: {
                ...CORS_HEADERS,
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300'
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'RWS API unreachable' }), {
            status: 502,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }
}
