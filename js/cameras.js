const Cameras = {
    markers: [],
    layerGroup: null,
    hlsPlayer: null,

    init(map) {
        this.layerGroup = L.layerGroup().addTo(map);
    },

    async loadRWS() {
        try {
            const res = await fetch('/api/cameras');
            if (!res.ok) throw new Error(`API status ${res.status}`);
            const cameras = await res.json();
            if (!Array.isArray(cameras) || cameras.length === 0) throw new Error('Geen camera data');

            return cameras.map(cam => {
                const id = cam.id;
                const road = cam.road || '';
                const near = cam.near || '';
                const slug = (road + '-' + near).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                const rwsPageUrl = `https://www.rwsverkeersinfo.nl/cameras/${id}/${slug}`;

                return {
                    id: String(id),
                    name: cam.location_description || cam.locationDescription || `${road} ${near}`.trim() || 'Camera',
                    road: road,
                    near: near,
                    lat: parseFloat(cam.latitude || cam.lat),
                    lon: parseFloat(cam.longitude || cam.lon),
                    rwsPageUrl: rwsPageUrl,
                    streamUrl: cam.stream_url || cam.streamUrl || null,
                    source: 'Rijkswaterstaat'
                };
            }).filter(c => !isNaN(c.lat) && !isNaN(c.lon));
        } catch (e) {
            console.warn('Camera API niet bereikbaar, fallback:', e.message);
            return this.getFallbackCameras();
        }
    },

    getFallbackCameras() {
        return [
            { id: '4', name: 'A1 Amersfoort', road: 'A1', near: 'Amersfoort', lat: 52.1561, lon: 5.3878, rwsPageUrl: 'https://www.rwsverkeersinfo.nl/cameras/4/a1-amersfoort', source: 'Rijkswaterstaat' },
            { id: '1', name: 'A2 Breukelen', road: 'A2', near: 'Breukelen', lat: 52.1728, lon: 4.9927, rwsPageUrl: 'https://www.rwsverkeersinfo.nl/cameras/1/a2-breukelen', source: 'Rijkswaterstaat' },
            { id: '6', name: 'A4 Leidschendam', road: 'A4', near: 'Leidschendam', lat: 52.0833, lon: 4.3833, rwsPageUrl: 'https://www.rwsverkeersinfo.nl/cameras/6/a4-leidschendam', source: 'Rijkswaterstaat' },
            { id: '10', name: 'A10 Amsterdam-West', road: 'A10', near: 'Amsterdam', lat: 52.3676, lon: 4.8344, rwsPageUrl: 'https://www.rwsverkeersinfo.nl/cameras/10/a10-amsterdam', source: 'Rijkswaterstaat' },
            { id: '12', name: 'A12 Den Haag', road: 'A12', near: 'Den Haag', lat: 52.0705, lon: 4.3007, rwsPageUrl: 'https://www.rwsverkeersinfo.nl/cameras/12/a12-den-haag', source: 'Rijkswaterstaat' },
            { id: '13', name: 'A13 Delft', road: 'A13', near: 'Delft', lat: 51.9975, lon: 4.3575, rwsPageUrl: 'https://www.rwsverkeersinfo.nl/cameras/13/a13-delft', source: 'Rijkswaterstaat' },
            { id: '15', name: 'A15 Europoort', road: 'A15', near: 'Europoort', lat: 51.8867, lon: 4.3250, rwsPageUrl: 'https://www.rwsverkeersinfo.nl/cameras/15/a15-europoort', source: 'Rijkswaterstaat' },
            { id: '16', name: 'A16 Dordrecht', road: 'A16', near: 'Dordrecht', lat: 51.8133, lon: 4.6692, rwsPageUrl: 'https://www.rwsverkeersinfo.nl/cameras/16/a16-dordrecht', source: 'Rijkswaterstaat' },
            { id: '20', name: 'A20 Rotterdam', road: 'A20', near: 'Rotterdam', lat: 51.9400, lon: 4.4300, rwsPageUrl: 'https://www.rwsverkeersinfo.nl/cameras/20/a20-rotterdam', source: 'Rijkswaterstaat' },
            { id: '27', name: 'A27 Gorinchem', road: 'A27', near: 'Gorinchem', lat: 51.8333, lon: 4.9667, rwsPageUrl: 'https://www.rwsverkeersinfo.nl/cameras/27/a27-gorinchem', source: 'Rijkswaterstaat' },
            { id: '28', name: 'A28 Amersfoort-Zuid', road: 'A28', near: 'Amersfoort', lat: 52.1400, lon: 5.3700, rwsPageUrl: 'https://www.rwsverkeersinfo.nl/cameras/28/a28-amersfoort', source: 'Rijkswaterstaat' },
            { id: '50', name: 'A50 Eindhoven', road: 'A50', near: 'Eindhoven', lat: 51.4416, lon: 5.4697, rwsPageUrl: 'https://www.rwsverkeersinfo.nl/cameras/50/a50-eindhoven', source: 'Rijkswaterstaat' },
            { id: '58', name: 'A58 Tilburg', road: 'A58', near: 'Tilburg', lat: 51.5519, lon: 5.0913, rwsPageUrl: 'https://www.rwsverkeersinfo.nl/cameras/58/a58-tilburg', source: 'Rijkswaterstaat' },
            { id: '7', name: 'A7 Groningen', road: 'A7', near: 'Groningen', lat: 53.2194, lon: 6.5665, rwsPageUrl: 'https://www.rwsverkeersinfo.nl/cameras/7/a7-groningen', source: 'Rijkswaterstaat' },
            { id: '9', name: 'A9 Haarlem', road: 'A9', near: 'Haarlem', lat: 52.3833, lon: 4.6333, rwsPageUrl: 'https://www.rwsverkeersinfo.nl/cameras/9/a9-haarlem', source: 'Rijkswaterstaat' }
        ];
    },

    show(cameras, map, onCameraClick) {
        this.layerGroup.clearLayers();
        this.markers = [];

        cameras.forEach(cam => {
            const marker = L.marker([cam.lat, cam.lon], {
                icon: L.divIcon({
                    className: 'camera-marker',
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                })
            });

            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                onCameraClick(cam);
            });

            marker.bindTooltip(cam.name, {
                direction: 'top',
                offset: [0, -8],
                className: 'camera-tooltip'
            });

            this.layerGroup.addLayer(marker);
            this.markers.push({ marker, camera: cam });
        });
    },

    hide() {
        this.layerGroup.clearLayers();
        this.markers = [];
    },

    destroyHls() {
        if (this.hlsPlayer) {
            this.hlsPlayer.destroy();
            this.hlsPlayer = null;
        }
    },

    renderCamera(cam) {
        const containerId = `cam-img-${cam.id}`;
        this.destroyHls();

        setTimeout(() => {
            this.tryStream(cam, containerId);
        }, 50);

        let html = '';
        if (cam.road) {
            html += `<p style="font-size:13px;color:var(--text);margin-bottom:6px;">Snelweg <b>${cam.road}</b>${cam.near ? ' bij ' + cam.near : ''}</p>`;
        }
        html += `<div id="${containerId}" style="min-height:40px;"><div class="loading">Live stream laden...</div></div>`;
        html += `<p style="font-size:11px;color:var(--text-dim);margin-top:4px;">Bron: ${cam.source || 'Rijkswaterstaat'}</p>`;
        return html;
    },

    async tryStream(cam, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const hlsUrl = `/api/camera-stream?id=${cam.id}`;
            const res = await fetch(hlsUrl);
            const ct = res.headers.get('content-type') || '';

            if (res.ok && ct.includes('mpegurl')) {
                this.showHlsPlayer(cam, containerId, hlsUrl);
                return;
            }
        } catch {}

        this.tryIframe(cam, containerId);
    },

    showHlsPlayer(cam, containerId, hlsUrl) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const videoId = `cam-video-${cam.id}`;
        container.innerHTML = `
            <video id="${videoId}" style="width:100%;border-radius:6px;background:#000;" autoplay muted playsinline></video>
            ${this.renderButtons(cam, 'hls')}`;

        const video = document.getElementById(videoId);
        if (!video) return;

        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = hlsUrl;
            video.play().catch(() => {});
        } else if (window.Hls && Hls.isSupported()) {
            this.destroyHls();
            const hls = new Hls({ liveDurationInfinity: true, lowLatencyMode: true });
            hls.loadSource(hlsUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.ERROR, () => {
                hls.destroy();
                this.tryIframe(cam, containerId);
            });
            this.hlsPlayer = hls;
        } else {
            this.tryIframe(cam, containerId);
        }
    },

    tryIframe(cam, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!cam.streamUrl) {
            this.trySnapshot(cam, containerId);
            return;
        }

        container.innerHTML = `
            <iframe id="cam-iframe-${cam.id}" src="${cam.streamUrl}"
                    style="width:100%;aspect-ratio:16/9;border:none;border-radius:6px;background:#000;"
                    allowfullscreen></iframe>
            ${this.renderButtons(cam, 'iframe')}`;

        const iframe = document.getElementById(`cam-iframe-${cam.id}`);
        if (iframe) {
            iframe.onerror = () => this.trySnapshot(cam, containerId);
            setTimeout(() => {
                try {
                    if (iframe.contentDocument === null && iframe.contentWindow === null) {
                        this.trySnapshot(cam, containerId);
                    }
                } catch {}
            }, 5000);
        }
    },

    trySnapshot(cam, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const img = new Image();
        img.onload = () => {
            container.innerHTML = `
                <img src="/api/camera-image?id=${cam.id}" alt="${cam.name}"
                     style="width:100%;border-radius:6px;background:#000;">
                ${this.renderButtons(cam, 'snapshot')}`;
        };
        img.onerror = () => {
            container.innerHTML = cam.rwsPageUrl
                ? `<a href="${cam.rwsPageUrl}" target="_blank" rel="noopener"
                      style="display:flex;align-items:center;gap:8px;padding:14px 16px;
                             background:var(--accent);color:#fff;text-decoration:none;
                             border-radius:8px;font-size:14px;font-weight:600;
                             margin:8px 0;justify-content:center;">
                       &#9654; Bekijk live camera op RWS
                   </a>`
                : '<p style="color:var(--text-dim);font-size:12px;">Camera niet beschikbaar</p>';
        };
        img.src = `/api/camera-image?id=${cam.id}`;
    },

    renderButtons(cam, active) {
        const btn = (label, mode, icon) => {
            const isActive = active === mode;
            const style = isActive
                ? 'background:var(--accent);border:1px solid var(--accent);color:#fff;'
                : 'background:var(--bg);border:1px solid var(--border);color:var(--text-dim);';
            return `<button onclick="Cameras.switchMode('${cam.id}','${mode}')"
                        style="${style}padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer;">${icon} ${label}</button>`;
        };

        return `<div style="display:flex;gap:6px;margin-top:6px;align-items:center;flex-wrap:wrap;">
            ${btn('Live', 'iframe', '&#9654;')}
            ${btn('Snapshot', 'snapshot', '&#128247;')}
            ${cam.rwsPageUrl ? `<a href="${cam.rwsPageUrl}" target="_blank" rel="noopener"
                style="font-size:11px;color:var(--accent);text-decoration:none;margin-left:auto;">
                Volledig scherm &rarr;</a>` : ''}
        </div>`;
    },

    switchMode(camId, mode) {
        const cam = App.cameras.find(c => c.id === camId);
        if (!cam) return;
        const containerId = `cam-img-${camId}`;
        this.destroyHls();

        if (mode === 'iframe') {
            this.tryIframe(cam, containerId);
        } else if (mode === 'snapshot') {
            this.trySnapshot(cam, containerId);
        }
    },

    refreshImage(camId) {
        const container = document.getElementById(`cam-img-${camId}`);
        if (!container) return;
        const img = container.querySelector('img');
        if (img) {
            img.src = `/api/camera-image?id=${camId}&t=${Date.now()}`;
        }
    }
};
