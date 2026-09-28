const ALLOWED_ORIGINS = [
    'https://brionicle.pages.dev',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
];

const ALLOWED_HOSTS = [
    'stream.inmoves.nl',
    'api.rwsverkeersinfo.nl',
    'opendata.ndw.nu',
    'webcams.windy.com',
    'www.webcam-autoroute.eu'
];

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === 'OPTIONS') {
            return handleCORS(request);
        }

        const targetUrl = url.searchParams.get('url');
        if (!targetUrl) {
            return new Response(JSON.stringify({ error: 'Missing ?url= parameter' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        let target;
        try {
            target = new URL(targetUrl);
        } catch {
            return new Response(JSON.stringify({ error: 'Invalid URL' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!ALLOWED_HOSTS.some(h => target.hostname === h || target.hostname.endsWith('.' + h))) {
            return new Response(JSON.stringify({ error: 'Host not allowed' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        try {
            const response = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Brionicle/1.0',
                    'Accept': request.headers.get('Accept') || '*/*'
                }
            });

            const headers = new Headers(response.headers);
            const origin = request.headers.get('Origin');
            if (origin && ALLOWED_ORIGINS.includes(origin)) {
                headers.set('Access-Control-Allow-Origin', origin);
            }
            headers.set('Cache-Control', 'public, max-age=30');

            return new Response(response.body, {
                status: response.status,
                headers
            });
        } catch (err) {
            return new Response(JSON.stringify({ error: 'Fetch failed', details: err.message }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
};

function handleCORS(request) {
    const origin = request.headers.get('Origin');
    const headers = {
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
    };
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }
    return new Response(null, { status: 204, headers });
}
