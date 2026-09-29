const Pins = {
    layers: {},
    data: {},

    TYPES: {
        festival: { color: '#e040fb', icon: '&#9835;', label: 'Festivals & Events' },
        concert: { color: '#e040fb', icon: '&#9835;', label: 'Festivals & Events' },
        venue: { color: '#e040fb', icon: '&#9835;', label: 'Festivals & Events' },
        kasteel: { color: '#ffb74d', icon: '&#9962;', label: 'Monumenten' },
        monument: { color: '#ffb74d', icon: '&#9962;', label: 'Monumenten' },
        museum: { color: '#ffb74d', icon: '&#9962;', label: 'Monumenten' },
        natuur: { color: '#66bb6a', icon: '&#9670;', label: 'Natuur' },
        telescoop: { color: '#90caf9', icon: '&#9733;', label: 'Telescopen' },
        radiotelescoop: { color: '#90caf9', icon: '&#9733;', label: 'Telescopen' },
        ruimtetelescoop: { color: '#90caf9', icon: '&#9733;', label: 'Telescopen' },
        wildlife: { color: '#4caf50', icon: '&#128062;', label: 'Live cam' },
        zoo: { color: '#4caf50', icon: '&#128059;', label: 'Dierentuin' },
        vulkaan: { color: '#ff5722', icon: '&#127755;', label: 'Vulkaan cam' },
        stadscam: { color: '#29b6f6', icon: '&#127903;', label: 'Stadscam' },
        streetart: { color: '#ff4081', icon: '&#127912;', label: 'Street art' },
        nachtleven: { color: '#ce93d8', icon: '&#127863;', label: 'Nachtleven' },
        grot: { color: '#8d6e63', icon: '&#9968;', label: 'Grot' }
    },

    init(map) {
        this.map = map;
        this.layers = {
            festivals: L.layerGroup(),
            monuments: L.layerGroup(),
            telescopes: L.layerGroup(),
            livecams: L.layerGroup(),
            urban: L.layerGroup(),
            caves: L.layerGroup()
        };
    },

    async loadAll() {
        const [festivals, monuments, telescopes, livecams, urban, caves] = await Promise.all([
            this.fetchJSON('data/festivals.json'),
            this.fetchJSON('data/monuments.json'),
            this.fetchJSON('data/telescopes.json'),
            this.fetchJSON('data/livecams.json'),
            this.fetchJSON('data/urban.json'),
            this.fetchJSON('data/caves.json')
        ]);
        this.data.festivals = festivals || [];
        this.data.monuments = monuments || [];
        this.data.telescopes = telescopes || [];
        this.data.livecams = livecams || [];
        this.data.urban = urban || [];
        this.data.caves = caves || [];
    },

    async fetchJSON(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) return [];
            return await res.json();
        } catch {
            return [];
        }
    },

    showLayer(layerName, onPinClick) {
        const layer = this.layers[layerName];
        if (!layer) return;
        layer.clearLayers();

        const items = this.data[layerName] || [];
        items.forEach(item => {
            const typeInfo = this.TYPES[item.type] || { color: '#aaa', icon: '&#9679;' };

            const marker = L.marker([item.lat, item.lon], {
                icon: L.divIcon({
                    className: 'pin-marker',
                    html: `<div style="
                        width:24px;height:24px;
                        background:${typeInfo.color};
                        border:2px solid #fff;
                        border-radius:50%;
                        box-shadow:0 0 8px ${typeInfo.color}80;
                        cursor:pointer;
                        display:flex;align-items:center;justify-content:center;
                        font-size:12px;line-height:1;
                    ">${typeInfo.icon}</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            });

            marker.bindTooltip(item.name, {
                direction: 'top',
                offset: [0, -14],
                className: 'camera-tooltip'
            });

            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                if (onPinClick) onPinClick(item);
            });

            layer.addLayer(marker);
        });

        layer.addTo(this.map);
    },

    hideLayer(layerName) {
        const layer = this.layers[layerName];
        if (layer) {
            layer.clearLayers();
            this.map.removeLayer(layer);
        }
    },

    renderHTML(item) {
        const typeInfo = this.TYPES[item.type] || { color: '#aaa', icon: '&#9679;', label: item.type };
        const parts = [];

        parts.push(`<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <div style="width:42px;height:42px;background:${typeInfo.color};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;box-shadow:0 0 12px ${typeInfo.color}40;">${typeInfo.icon}</div>
            <div>
                <div style="font-size:16px;font-weight:700;">${item.name}</div>
                <div style="font-size:12px;color:var(--text-dim);">${typeInfo.label || item.type}${item.country ? ' · ' + item.country : ''}</div>
            </div>
        </div>`);

        if (item.description) {
            parts.push(`<p style="font-size:13px;color:var(--text);margin-bottom:8px;line-height:1.5;">${item.description}</p>`);
        }

        if (item.dates) {
            parts.push(`<p style="font-size:12px;color:var(--text-dim);margin-bottom:4px;">&#128197; ${item.dates}</p>`);
        }

        if (item.genre) {
            parts.push(`<p style="font-size:12px;color:var(--text-dim);margin-bottom:4px;">&#9835; ${item.genre}</p>`);
        }

        if (item.website) {
            const isLiveCam = ['wildlife', 'zoo', 'vulkaan', 'stadscam'].includes(item.type);
            const label = isLiveCam ? '&#9654; Bekijk live' : 'Website';
            parts.push(`<a href="${item.website}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:8px 16px;background:var(--accent);color:#000;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">${label} &rarr;</a>`);
        }

        if (item.webcamUrl) {
            parts.push(`<a href="${item.webcamUrl}" target="_blank" rel="noopener" style="display:inline-block;margin-top:4px;font-size:12px;color:var(--accent);text-decoration:none;">Webcam &rarr;</a>`);
        }

        return parts.join('');
    },

    renderYouTube(item) {
        if (!item.youtubeChannel) return '';

        const isLiveCam = ['wildlife', 'zoo', 'vulkaan', 'stadscam'].includes(item.type);
        const channelUrl = item.youtubeChannel.startsWith('UC')
            ? `https://www.youtube.com/channel/${item.youtubeChannel}`
            : `https://www.youtube.com/@${item.youtubeChannel}`;

        let html = '<h3>Live stream</h3>';

        if (isLiveCam) {
            const ytWrapperId = `yt-wrapper-${item.id}`;
            const embedUrl = item.youtubeVideo
                ? `https://www.youtube.com/embed/${item.youtubeVideo}?autoplay=1&mute=1`
                : `https://www.youtube.com/embed/live_stream?channel=${item.youtubeChannel}`;
            html += `
                <div id="${ytWrapperId}" style="position:relative;border-radius:6px;overflow:hidden;margin-bottom:8px;background:#000;">
                    <iframe src="${embedUrl}"
                            width="100%" height="200" frameborder="0"
                            allow="autoplay; encrypted-media" allowfullscreen
                            style="background:#000;display:block;">
                    </iframe>
                    <button onclick="Pins.toggleYtFullscreen('${ytWrapperId}')" style="
                        position:absolute;bottom:8px;right:8px;
                        background:rgba(0,0,0,0.6);border:none;color:#fff;
                        width:32px;height:32px;border-radius:4px;cursor:pointer;
                        font-size:16px;display:flex;align-items:center;justify-content:center;
                        z-index:10;" title="Volledig scherm">&#x26F6;</button>
                </div>
            `;
        }

        html += `<a href="${channelUrl}" target="_blank" rel="noopener" style="font-size:12px;color:var(--accent);text-decoration:none;">YouTube kanaal openen &rarr;</a>`;
        return html;
    },

    toggleYtFullscreen(wrapperId) {
        const wrapper = document.getElementById(wrapperId);
        if (!wrapper) return;
        const iframe = wrapper.querySelector('iframe');

        if (wrapper.classList.contains('pin-fullscreen')) {
            wrapper.classList.remove('pin-fullscreen');
            wrapper.style.cssText = 'position:relative;border-radius:6px;overflow:hidden;margin-bottom:8px;background:#000;';
            if (iframe) iframe.style.height = '200px';
        } else {
            wrapper.classList.add('pin-fullscreen');
            wrapper.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:10000;background:#000;border-radius:0;overflow:hidden;';
            if (iframe) iframe.style.height = '100vh';
        }
    },

    renderHlsStream(item) {
        if (!item.streamId) return '';
        const videoId = `hls-${item.streamId}`;
        const wrapperId = `wrapper-${item.streamId}`;
        let html = '<h3>Live stream</h3>';
        html += `<div id="${wrapperId}" style="position:relative;border-radius:6px;overflow:hidden;margin-bottom:8px;background:#000;">`;
        html += `<video id="${videoId}" width="100%" height="200" muted autoplay playsinline
                    style="background:#000;object-fit:cover;display:block;"></video>`;
        html += `<button onclick="Pins.toggleFullscreen('${wrapperId}','${videoId}')" style="
            position:absolute;bottom:8px;right:8px;
            background:rgba(0,0,0,0.6);border:none;color:#fff;
            width:32px;height:32px;border-radius:4px;cursor:pointer;
            font-size:16px;display:flex;align-items:center;justify-content:center;
            z-index:10;" title="Volledig scherm">&#x26F6;</button>`;
        html += `</div>`;
        html += `<div id="${videoId}-status" style="font-size:11px;color:var(--text-dim);margin-bottom:4px;">Stream laden...</div>`;

        setTimeout(() => {
            const video = document.getElementById(videoId);
            const status = document.getElementById(videoId + '-status');
            if (!video) return;
            const src = `/api/camera-stream?id=${item.streamId}`;

            const showWebsiteFallback = () => {
                if (!item.website) return;
                const wrapper = document.getElementById(wrapperId);
                if (!wrapper) return;
                const thumbUrl = item.skylineId ? `https://embed.skylinewebcams.com/img/${item.skylineId}.jpg?t=${Date.now()}` : '';
                wrapper.innerHTML = `
                    <a href="${item.website}" target="_blank" rel="noopener" style="display:block;position:relative;text-decoration:none;">
                        ${thumbUrl ? `<img src="${thumbUrl}" width="100%" style="display:block;border-radius:6px;background:#111;" alt="${item.name}">` : ''}
                        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                            background:rgba(0,0,0,0.7);color:#fff;padding:10px 20px;border-radius:8px;
                            font-size:14px;font-weight:600;pointer-events:none;">
                            &#9654; Bekijk live stream
                        </div>
                    </a>`;
                if (status) status.textContent = 'Klik voor live stream op website';
            };

            if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                const hls = new Hls({ maxBufferLength: 10, liveSyncDurationCount: 3 });
                hls.loadSource(src);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    video.play().catch(() => {});
                    if (status) status.textContent = 'Live';
                });
                hls.on(Hls.Events.ERROR, (_, data) => {
                    if (data.fatal) {
                        hls.destroy();
                        Pins._activeHls = null;
                        showWebsiteFallback();
                    }
                });
                Pins._activeHls = hls;
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = src;
                video.addEventListener('error', () => showWebsiteFallback(), { once: true });
                video.play().catch(() => {});
                if (status) status.textContent = 'Live';
            } else {
                showWebsiteFallback();
            }
        }, 100);

        return html;
    },

    toggleFullscreen(wrapperId, videoId) {
        const wrapper = document.getElementById(wrapperId);
        if (!wrapper) return;

        const media = videoId ? document.getElementById(videoId) : wrapper.querySelector('iframe, video');

        if (wrapper.classList.contains('pin-fullscreen')) {
            wrapper.classList.remove('pin-fullscreen');
            wrapper.style.cssText = 'position:relative;border-radius:6px;overflow:hidden;margin-bottom:8px;background:#000;';
            if (media) media.style.height = media.tagName === 'IFRAME' ? '300px' : '200px';
        } else {
            wrapper.classList.add('pin-fullscreen');
            wrapper.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:10000;background:#000;border-radius:0;overflow:hidden;';
            if (media) media.style.height = '100vh';
        }
    },

    destroyActiveHls() {
        if (this._activeHls) {
            this._activeHls.destroy();
            this._activeHls = null;
        }
    }
};
