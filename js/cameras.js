const Cameras = {
    markers: [],
    layerGroup: null,
    liveInterval: null,
    desktopAvailable: null,
    _timelapseData: {},

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

    stopLive() {
        if (this.liveInterval) {
            clearInterval(this.liveInterval);
            this.liveInterval = null;
        }
        this.destroyHls();
    },

    renderCamera(cam) {
        const containerId = `cam-img-${cam.id}`;
        this.stopLive();
        this.stopTimelapsePlay(cam.id);

        setTimeout(() => this.showStream(cam, containerId), 50);

        let html = '';
        if (cam.road) {
            html += `<p style="font-size:13px;color:var(--text);margin-bottom:6px;">Snelweg <b>${cam.road}</b>${cam.near ? ' bij ' + cam.near : ''}</p>`;
        }
        html += `<div id="${containerId}" style="min-height:40px;"><div class="loading">Camera laden...</div></div>`;
        html += `<p style="font-size:11px;color:var(--text-dim);margin-top:4px;">Bron: ${cam.source || 'Rijkswaterstaat'}</p>`;
        return html;
    },

    requestDesktop(cam, action) {
        fetch('/api/camera-control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: action,
                camera: { id: cam.id, rwsUrl: cam.rwsPageUrl },
                cameraId: cam.id
            })
        }).catch(() => {});
    },

    startLive(cam, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (this.desktopAvailable !== false) {
            const desktopImg = new Image();
            desktopImg.onload = () => {
                this.desktopAvailable = true;
                this.showLiveView(cam, containerId, 'desktop');
            };
            desktopImg.onerror = () => {
                this.desktopAvailable = false;
                this.trySnapshot(cam, containerId);
            };
            desktopImg.src = `/api/camera-live?id=${cam.id}&t=${Date.now()}`;
        } else {
            this.trySnapshot(cam, containerId);
        }
    },

    trySnapshot(cam, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const img = new Image();
        img.onload = () => {
            this.showLiveView(cam, containerId, 'snapshot');
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
        img.src = `/api/camera-image?id=${cam.id}&t=${Date.now()}`;
    },

    showStream(cam, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        this.stopLive();
        this.destroyHls();

        if (typeof Hls === 'undefined' || !Hls.isSupported()) {
            this.requestDesktop(cam, 'start_live');
            this.startLive(cam, containerId);
            return;
        }

        container.innerHTML = `
            <div style="position:relative;border-radius:6px;overflow:hidden;background:#000;">
                <video id="cam-hls-${cam.id}" autoplay muted playsinline
                    style="width:100%;border-radius:6px;background:#000;display:block;"></video>
                <span id="cam-label-${cam.id}" style="position:absolute;top:8px;right:8px;
                    background:rgba(0,0,0,0.6);color:#4caf50;padding:2px 8px;border-radius:10px;
                    font-size:11px;font-weight:600;display:flex;align-items:center;gap:4px;">
                    <span style="width:6px;height:6px;background:#4caf50;border-radius:50%;display:inline-block;animation:blink 1s infinite;"></span>
                    LIVE STREAM
                </span>
                <div id="cam-loading-${cam.id}" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:13px;">
                    Stream laden...</div>
            </div>
            ${this.renderButtons(cam, 'stream')}`;

        const video = document.getElementById(`cam-hls-${cam.id}`);
        const loadingEl = document.getElementById(`cam-loading-${cam.id}`);
        const streamUrl = `/api/camera-stream?id=${cam.id}`;

        const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            maxBufferLength: 5,
            maxMaxBufferLength: 10,
            liveSyncDurationCount: 2,
            liveMaxLatencyDurationCount: 5,
        });
        this._hls = hls;

        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (loadingEl) loadingEl.style.display = 'none';
            video.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                hls.destroy();
                this._hls = null;
                this.trySnapshot(cam, containerId);
            }
        });
    },

    destroyHls() {
        if (this._hls) {
            this._hls.destroy();
            this._hls = null;
        }
    },

    showLiveView(cam, containerId, source) {
        const container = document.getElementById(containerId);
        if (!container) return;
        this.stopLive();

        const imgSrc = source === 'desktop'
            ? `/api/camera-live?id=${cam.id}&t=${Date.now()}`
            : `/api/camera-image?id=${cam.id}&t=${Date.now()}`;

        const sourceLabel = source === 'desktop' ? 'HD LIVE' : 'LIVE';
        const dotColor = source === 'desktop' ? '#4caf50' : '#f44';

        container.innerHTML = `
            <div style="position:relative;">
                <img id="cam-live-${cam.id}" src="${imgSrc}" alt="${cam.name}"
                     style="width:100%;border-radius:6px;background:#000;">
                <span style="position:absolute;top:8px;right:8px;
                    background:rgba(0,0,0,0.6);color:${dotColor};padding:2px 8px;border-radius:10px;
                    font-size:11px;font-weight:600;display:flex;align-items:center;gap:4px;">
                    <span style="width:6px;height:6px;background:${dotColor};border-radius:50%;display:inline-block;animation:blink 1s infinite;"></span>
                    ${sourceLabel}
                </span>
            </div>
            ${this.renderButtons(cam, 'live')}`;

        const endpoint = source === 'desktop' ? '/api/camera-live' : '/api/camera-image';
        const interval = source === 'desktop' ? 2000 : 3000;

        this.liveInterval = setInterval(() => {
            const liveImg = document.getElementById(`cam-live-${cam.id}`);
            if (!liveImg) { this.stopLive(); return; }
            const next = new Image();
            next.onload = () => { liveImg.src = next.src; };
            next.src = `${endpoint}?id=${cam.id}&t=${Date.now()}`;
        }, interval);
    },

    showSnapshot(cam, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        this.stopLive();

        container.innerHTML = `
            <img src="/api/camera-image?id=${cam.id}&t=${Date.now()}" alt="${cam.name}"
                 style="width:100%;border-radius:6px;background:#000;"
                 onerror="this.style.display='none'">
            ${this.renderButtons(cam, 'snapshot')}`;
    },

    async showTimelapse(cam, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        this.stopLive();
        this.stopTimelapsePlay(cam.id);

        container.innerHTML = '<div class="loading">Timelapse laden...</div>';

        try {
            const res = await fetch(`/api/timelapse?id=${cam.id}&action=list`);
            const data = await res.json();

            if (!data.frames || data.frames.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center;padding:20px;">
                        <p style="color:var(--text-dim);font-size:13px;margin-bottom:10px;">
                            Nog geen timelapse beelden beschikbaar.
                        </p>
                        <button onclick="Cameras.requestDesktop({id:'${cam.id}',rwsPageUrl:'${cam.rwsPageUrl}'},'start_timelapse')"
                            style="background:var(--accent);border:none;color:#fff;padding:8px 16px;border-radius:6px;font-size:12px;cursor:pointer;">
                            &#9202; Start timelapse opname
                        </button>
                    </div>
                    ${this.renderButtons(cam, 'timelapse')}`;
                return;
            }

            const frames = data.frames;
            const firstFrame = frames[0].key.split('/').pop().replace('.jpg', '');

            container.innerHTML = `
                <div style="position:relative;">
                    <img id="tl-img-${cam.id}" src="/api/timelapse?id=${cam.id}&frame=${firstFrame}"
                         alt="Timelapse" style="width:100%;border-radius:6px;background:#000;">
                    <span style="position:absolute;top:8px;right:8px;
                        background:rgba(0,0,0,0.6);color:#ff9800;padding:2px 8px;border-radius:10px;
                        font-size:11px;font-weight:600;">&#9202; TIMELAPSE</span>
                </div>
                <div style="margin-top:6px;display:flex;align-items:center;gap:8px;">
                    <button id="tl-play-${cam.id}" onclick="Cameras.toggleTimelapse('${cam.id}')"
                        style="background:var(--accent);border:none;color:#fff;width:32px;height:24px;border-radius:4px;font-size:11px;cursor:pointer;">
                        &#9654;</button>
                    <input id="tl-slider-${cam.id}" type="range" min="0" max="${frames.length - 1}" value="0"
                        style="flex:1;accent-color:var(--accent);"
                        oninput="Cameras.seekTimelapse('${cam.id}',this.value)">
                    <select id="tl-speed-${cam.id}" onchange="Cameras.setTimelapseSpeed('${cam.id}',this.value)"
                        style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:2px 4px;border-radius:4px;font-size:10px;">
                        <option value="100">8x</option>
                        <option value="200">4x</option>
                        <option value="500" selected>2x</option>
                        <option value="1000">1x</option>
                    </select>
                    <span id="tl-counter-${cam.id}" style="font-size:10px;color:var(--text-dim);min-width:48px;text-align:right;">
                        1/${frames.length}</span>
                </div>
                ${this.renderButtons(cam, 'timelapse')}`;

            this._timelapseData[cam.id] = { frames, index: 0, playing: false, speed: 500, timer: null };

        } catch {
            container.innerHTML = `
                <p style="color:var(--text-dim);font-size:12px;padding:12px;">Timelapse niet beschikbaar</p>
                ${this.renderButtons(cam, 'timelapse')}`;
        }
    },

    toggleTimelapse(camId) {
        const data = this._timelapseData[camId];
        if (!data) return;

        if (data.playing) {
            data.playing = false;
            if (data.timer) clearInterval(data.timer);
            const btn = document.getElementById(`tl-play-${camId}`);
            if (btn) btn.innerHTML = '&#9654;';
        } else {
            data.playing = true;
            const btn = document.getElementById(`tl-play-${camId}`);
            if (btn) btn.innerHTML = '&#10074;&#10074;';
            this.runTimelapse(camId);
        }
    },

    runTimelapse(camId) {
        const data = this._timelapseData[camId];
        if (!data) return;
        if (data.timer) clearInterval(data.timer);

        data.timer = setInterval(() => {
            if (!data.playing) return;
            data.index = (data.index + 1) % data.frames.length;
            this.renderTimelapseFrame(camId);
        }, data.speed);
    },

    seekTimelapse(camId, index) {
        const data = this._timelapseData[camId];
        if (!data) return;
        data.index = parseInt(index);
        this.renderTimelapseFrame(camId);
    },

    setTimelapseSpeed(camId, speed) {
        const data = this._timelapseData[camId];
        if (!data) return;
        data.speed = parseInt(speed);
        if (data.playing) this.runTimelapse(camId);
    },

    renderTimelapseFrame(camId) {
        const data = this._timelapseData[camId];
        if (!data || !data.frames[data.index]) return;

        const frameKey = data.frames[data.index].key.split('/').pop().replace('.jpg', '');
        const img = document.getElementById(`tl-img-${camId}`);
        const slider = document.getElementById(`tl-slider-${camId}`);
        const counter = document.getElementById(`tl-counter-${camId}`);

        if (img) img.src = `/api/timelapse?id=${camId}&frame=${frameKey}`;
        if (slider) slider.value = data.index;
        if (counter) counter.textContent = `${data.index + 1}/${data.frames.length}`;
    },

    stopTimelapsePlay(camId) {
        const data = this._timelapseData[camId];
        if (data) {
            data.playing = false;
            if (data.timer) clearInterval(data.timer);
        }
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
            ${btn('Stream', 'stream', '&#9654;')}
            ${btn('Snapshot', 'snapshot', '&#128247;')}
            ${btn('Timelapse', 'timelapse', '&#9202;')}
            ${cam.rwsPageUrl ? `<a href="${cam.rwsPageUrl}" target="_blank" rel="noopener"
                style="font-size:11px;color:var(--accent);text-decoration:none;margin-left:auto;">
                Volledig scherm &rarr;</a>` : ''}
        </div>`;
    },

    switchMode(camId, mode) {
        const cam = App.cameras.find(c => c.id === camId);
        if (!cam) return;
        const containerId = `cam-img-${camId}`;

        this.stopTimelapsePlay(camId);
        this.destroyHls();

        if (mode === 'stream') {
            this.showStream(cam, containerId);
        } else if (mode === 'timelapse') {
            this.showTimelapse(cam, containerId);
        } else {
            this.showSnapshot(cam, containerId);
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
