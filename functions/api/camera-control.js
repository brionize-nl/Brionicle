const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
};

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
    const bucket = context.env.LIVE_BUCKET;
    if (!bucket) {
        return new Response(JSON.stringify({ live: [], timelapse: [] }), {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    try {
        const obj = await bucket.get('control.json');
        if (!obj) {
            return new Response(JSON.stringify({ live: [], timelapse: [] }), {
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }
        const body = await obj.text();
        return new Response(body, {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
        });
    } catch {
        return new Response(JSON.stringify({ live: [], timelapse: [] }), {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }
}

export async function onRequestPost(context) {
    const bucket = context.env.LIVE_BUCKET;
    if (!bucket) {
        return new Response(JSON.stringify({ error: 'R2 niet geconfigureerd' }), {
            status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await context.request.json();
        const { action, camera, cameraId } = body;

        const existing = await bucket.get('control.json');
        let control = { live: [], timelapse: [] };
        if (existing) {
            try { control = JSON.parse(await existing.text()); } catch {}
        }

        if (!control.live) control.live = [];
        if (!control.timelapse) control.timelapse = [];

        switch (action) {
            case 'start_live':
                if (camera && !control.live.find(c => c.id === camera.id)) {
                    if (control.live.length >= 3) control.live.shift();
                    control.live.push({ id: camera.id, rwsUrl: camera.rwsUrl });
                }
                break;

            case 'stop_live':
                control.live = control.live.filter(c => c.id !== cameraId);
                break;

            case 'start_timelapse':
                if (camera && !control.timelapse.find(c => c.id === camera.id)) {
                    control.timelapse.push({ id: camera.id, rwsUrl: camera.rwsUrl });
                }
                break;

            case 'stop_timelapse':
                control.timelapse = control.timelapse.filter(c => c.id !== cameraId);
                break;

            case 'stop_all':
                control = { live: [], timelapse: [] };
                break;

            default:
                return new Response(JSON.stringify({ error: 'Onbekende actie' }), {
                    status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
                });
        }

        control.updated = new Date().toISOString();
        await bucket.put('control.json', JSON.stringify(control));

        return new Response(JSON.stringify(control), {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }
}
