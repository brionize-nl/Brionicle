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
            const playing = this.currentStation === s.id;
            const nameStyle = playing ? 'font-size:13px;color:var(--success);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' : 'font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
            const safeUrl = encodeURIComponent(s.streamUrl);

            return `
                <div class="radio-station" data-sid="${s.id}" data-url="${safeUrl}" style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;">
                    ${icon}
                    <div style="flex:1;min-width:0;">
                        <div style="${nameStyle}">${s.name}</div>
                        ${genre}
                    </div>
                    <span class="radio-play-btn" style="font-size:18px;color:var(--accent);">${playing ? '&#9724;' : '&#9654;'}</span>
                </div>
            `;
        }).join('');

        setTimeout(() => {
            document.querySelectorAll('.radio-station[data-sid]').forEach(el => {
                el.addEventListener('click', () => {
                    Radio.toggle(el.dataset.sid, decodeURIComponent(el.dataset.url));
                });
            });
        }, 0);

        return `<h3>Radio in de buurt</h3>${items}`;
    },

    toggle(stationId, streamUrl) {
        if (this.currentStation === stationId) {
            this.stop();
            this.updateUI();
            return;
        }

        this.stop();
        this.currentAudio = new Audio(streamUrl);
        this.currentAudio.volume = 0.7;
        this.currentAudio.play().catch(() => {});
        this.currentStation = stationId;
        this.updateUI();
    },

    updateUI() {
        document.querySelectorAll('.radio-station[data-sid]').forEach(el => {
            const isPlaying = el.dataset.sid === this.currentStation;
            const btn = el.querySelector('.radio-play-btn');
            const name = el.querySelector('div > div');
            if (btn) btn.innerHTML = isPlaying ? '&#9724;' : '&#9654;';
            if (name) name.style.color = isPlaying ? 'var(--success)' : '';
        });
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
