const Wikipedia = {
    async fetch(lat, lon) {
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=5000&gslimit=3&format=json&origin=*`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const pages = data.query?.geosearch;
        if (!pages || pages.length === 0) return null;

        const pageIds = pages.map(p => p.pageid).join('|');
        const detailUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageIds}&prop=extracts|pageimages&exintro=true&explaintext=true&exsentences=3&piprop=thumbnail&pithumbsize=400&format=json&origin=*`;
        const detailRes = await fetch(detailUrl);
        if (!detailRes.ok) return null;
        const detailData = await detailRes.json();

        return Object.values(detailData.query.pages).map(page => ({
            title: page.title,
            extract: page.extract,
            thumbnail: page.thumbnail?.source || null,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`
        }));
    },

    renderHTML(articles) {
        if (!articles || articles.length === 0) return '';

        const items = articles.map(a => {
            const img = a.thumbnail
                ? `<img src="${a.thumbnail}" alt="${a.title}" loading="lazy" style="width:100%;border-radius:4px;margin-bottom:8px;">`
                : '';
            const extract = a.extract ? `<p style="font-size:13px;color:var(--text);margin:4px 0 8px;">${a.extract}</p>` : '';
            return `
                <div style="margin-bottom:12px;">
                    ${img}
                    <a href="${a.url}" target="_blank" rel="noopener" style="color:var(--accent);font-size:14px;font-weight:500;text-decoration:none;">${a.title}</a>
                    ${extract}
                </div>
            `;
        }).join('');

        return `<h3>In de buurt</h3>${items}`;
    }
};
