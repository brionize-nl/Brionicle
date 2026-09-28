const Radio = {
    currentAudio: null,
    currentStation: null,

    async fetchNearby(lat, lon, radius) {
        radius = radius || 50000;
        const url = `https://de1.api.radio-browser.info/json/stations/bycoordinate/${lat}/${lon}/${radius}?limit=10&order=clickcount&reverse=true`;
        const res = await fetch(url);
        if (!res.ok) return [];
        return (await res.json()).map(s => ({
            id: s.stationuuid,
            name: s.name,
            country: s.country,
            language: s.language,
            genre: s.tags,
            codec: s.codec,
            bitrate: s.bitrate,
            streamUrl: s.url_resolved || s.url,
            favicon: s.favicon,
            homepage: s.homepage
        }));
    },

    renderHTML(stations) {
        if (!stations || stations.length === 0) return '';

        const items = stations.map(s => {
            const icon = s.favicon
                ? `<img src="${s.favicon}" width="24" height="24" style="border-radius:4px;object-fit:cover;" onerror="this.style.display='none'">`
                : `<span style="display:inline-block;width:24px;height:24px;background:var(--bg);border-radius:4px;text-align:center;line-height:24px;font-size:12px;">&#9835;</span>`;
            const genre = s.genre ? `<span style="font-size:11px;color:var(--text-dim);">${s.genre.split(',').slice(0, 2).join(', ')}</span>` : '';
            const playing = this.currentStation === s.id ? ' style="color:var(--success);"' : '';

            return `
                <div class="radio-station" onclick="Radio.toggle('${s.id}', '${s.streamUrl.replace(/'/g, "\\'")}')" style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;">
                    ${icon}
                    <div style="flex:1;min-width:0;">
                        <div${playing} style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.name}</div>
                        ${genre}
                    </div>
                    <span style="font-size:18px;color:var(--accent);">${this.currentStation === s.id ? '&#9724;' : '&#9654;'}</span>
                </div>
            `;
        }).join('');

        return `<h3>Radio in de buurt</h3>${items}`;
    },

    toggle(stationId, streamUrl) {
        if (this.currentStation === stationId) {
            this.stop();
            return;
        }

        this.stop();
        this.currentAudio = new Audio(streamUrl);
        this.currentAudio.volume = 0.7;
        this.currentAudio.play().catch(() => {});
        this.currentStation = stationId;

        document.querySelectorAll('.radio-station').forEach(el => {
            el.querySelector('span:last-child').innerHTML = '&#9654;';
        });
        event.currentTarget.querySelector('span:last-child').innerHTML = '&#9724;';
    },

    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.src = '';
            this.currentAudio = null;
        }
        this.currentStation = null;
    }
};
