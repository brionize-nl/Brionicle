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

    const imagePatterns = [
        `https://api.rwsverkeersinfo.nl/api/cameras/${id}/image`,
        `https://api.rwsverkeersinfo.nl/api/cameras/${id}/snapshot`,
        `https://www.rwsverkeersinfo.nl/api/cameras/${id}/image`,
    ];

    for (const imageUrl of imagePatterns) {
        try {
            const res = await fetch(imageUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Brionicle/1.0)' }
            });
            const ct = res.headers.get('content-type') || '';
            if (res.ok && ct.startsWith('image/')) {
                return new Response(res.body, {
                    headers: {
                        ...CORS_HEADERS,
                        'Content-Type': ct,
                        'Cache-Control': 'public, max-age=3'
                    }
                });
            }
        } catch {}
    }

    try {
        const apiRes = await fetch('https://api.rwsverkeersinfo.nl/api/cameras', {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Brionicle/1.0)' }
        });
        if (!apiRes.ok) throw new Error('API down');
        const cameras = await apiRes.json();
        const cam = cameras.find(c => String(c.id) === id);

        if (cam) {
            const road = cam.road || '';
            const near = cam.near || '';
            const slug = (road + '-' + near).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            const pageUrl = `https://www.rwsverkeersinfo.nl/cameras/${id}/${slug}`;

            const pageRes = await fetch(pageUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            if (pageRes.ok) {
                const html = await pageRes.text();
                const imgMatches = [
                    ...html.matchAll(/src=["'](https?:\/\/[^"']*?\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)['"]/gi),
                    ...html.matchAll(/url\(["']?(https?:\/\/[^)"']*?\.(?:jpg|jpeg|png|webp)(?:\?[^)"']*)?)["']?\)/gi),
                    ...html.matchAll(/"(https?:\/\/[^"]*?(?:image|snapshot|camera|webcam)[^"]*?)"/gi)
                ];

                for (const match of imgMatches) {
                    const imgUrl = match[1];
                    if (imgUrl.includes('logo') || imgUrl.includes('icon') || imgUrl.includes('favicon')) continue;
                    try {
                        const imgRes = await fetch(imgUrl, {
                            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Brionicle/1.0)' }
                        });
                        const ct2 = imgRes.headers.get('content-type') || '';
                        if (imgRes.ok && ct2.startsWith('image/')) {
                            return new Response(imgRes.body, {
                                headers: {
                                    ...CORS_HEADERS,
                                    'Content-Type': ct2,
                                    'Cache-Control': 'public, max-age=3'
                                }
                            });
                        }
                    } catch {}
                }
            }
        }
    } catch {}

    return new Response(JSON.stringify({ error: 'No camera image found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
}
