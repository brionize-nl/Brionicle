const App = {
    map: null,
    cameras: [],
    currentCamera: null,
    panelOpen: false,

    async init() {
        this.initMap();
        this.initPanel();
        this.initLayers();
        this.initLocate();

        Cameras.init(this.map);
        Flights.init(this.map);
        Castles.init(this.map);

        await Promise.all([this.loadCameras(), Castles.load()]);

        this.showActiveLayers();
        this.registerServiceWorker();
    },

    initMap() {
        this.map = L.map('map', {
            center: [52.1, 5.3],
            zoom: 8,
            zoomControl: true,
            attributionControl: true
        });

        this.tileLayer = null;
        const saved = localStorage.getItem('brionicle-mapstyle') || 'old-world';
        this.setMapStyle(saved);

        this.map.on('click', (e) => {
            if (!this.panelOpen) {
                this.showLocationInfo(e.latlng.lat, e.latlng.lng);
            }
        });
    },

    setMapStyle(style) {
        if (this.tileLayer) this.map.removeLayer(this.tileLayer);

        this.tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19
        });

        if (style === 'old-world') {
            document.body.classList.add('old-world');
            if (this.isChecked('layer-castles') && Castles.data.length) {
                Castles.show((c) => this.onCastleClick(c));
            }
        } else {
            document.body.classList.remove('old-world');
            Castles.hide();
        }

        this.tileLayer.addTo(this.map);
        localStorage.setItem('brionicle-mapstyle', style);

        const radio = document.querySelector(`input[name="mapstyle"][value="${style}"]`);
        if (radio) radio.checked = true;
    },

    initPanel() {
        document.getElementById('panel-close').addEventListener('click', () => this.closePanel());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closePanel();
        });

        const panel = document.getElementById('panel');
        let touchStartY = 0;
        let touchStartX = 0;
        panel.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
            touchStartX = e.touches[0].clientX;
        }, { passive: true });
        panel.addEventListener('touchend', (e) => {
            const dy = e.changedTouches[0].clientY - touchStartY;
            const dx = Math.abs(e.changedTouches[0].clientX - touchStartX);
            if (dy > 80 && dx < 60) this.closePanel();
        }, { passive: true });
    },

    initLayers() {
        const layersBtn = document.getElementById('layers-btn');
        const layersMenu = document.getElementById('layers-menu');

        layersBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            layersMenu.classList.toggle('hidden');
        });

        document.addEventListener('click', () => layersMenu.classList.add('hidden'));
        layersMenu.addEventListener('click', (e) => e.stopPropagation());

        const layerHandlers = {
            'layer-cameras': (on) => on ? Cameras.show(this.cameras, this.map, (c) => this.onCameraClick(c)) : Cameras.hide(),
            'layer-flights': (on) => on ? Flights.show() : Flights.hide(),
            'layer-castles': (on) => on ? Castles.show((c) => this.onCastleClick(c)) : Castles.hide()
        };

        Object.entries(layerHandlers).forEach(([id, handler]) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', (e) => handler(e.target.checked));
        });

        document.querySelectorAll('input[name="mapstyle"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.setMapStyle(e.target.value));
        });
    },

    initLocate() {
        const btn = document.getElementById('locate-btn');
        if (!btn) return;
        this.locationMarker = null;

        btn.addEventListener('click', () => {
            if (!navigator.geolocation) return;
            btn.classList.add('active');
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude: lat, longitude: lon } = pos.coords;
                    this.map.flyTo([lat, lon], 13);
                    if (this.locationMarker) this.map.removeLayer(this.locationMarker);
                    this.locationMarker = L.circleMarker([lat, lon], {
                        radius: 8, fillColor: '#4fc3f7', fillOpacity: 0.9,
                        color: '#fff', weight: 3
                    }).addTo(this.map);
                    this.locationMarker.bindTooltip('Jij bent hier', {
                        direction: 'top', offset: [0, -10], className: 'camera-tooltip'
                    });
                    setTimeout(() => btn.classList.remove('active'), 2000);
                },
                () => { btn.classList.remove('active'); },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    },

    showActiveLayers() {
        if (this.isChecked('layer-cameras')) Cameras.show(this.cameras, this.map, (c) => this.onCameraClick(c));
        if (this.isChecked('layer-flights')) Flights.show();
        if (this.isChecked('layer-castles') && document.body.classList.contains('old-world')) {
            Castles.show((c) => this.onCastleClick(c));
        }
    },

    isChecked(id) {
        const el = document.getElementById(id);
        return el && el.checked;
    },

    async loadCameras() {
        this.cameras = await Cameras.loadRWS();
        console.log(`${this.cameras.length} camera's geladen`);
    },

    onCameraClick(cam) {
        this.currentCamera = cam;
        this.openPanel();
        this.setPanelHeader(cam.name, [cam.road, cam.source].filter(Boolean).join(' — '));

        const sections = this.clearSections();
        sections.camera.innerHTML = Cameras.renderCamera(cam);
        this.loadWeather(cam.lat, cam.lon, sections.weather);
        this.loadSunTimes(cam.lat, cam.lon, sections.sun);
    },

    onFlightClick(ac) {
        const callsign = (ac.flight || '').trim();
        const hex = (ac.hex || '').toUpperCase();
        const type = ac.t || '';
        this.openPanel();
        this.setPanelHeader(callsign || hex, `Vliegtuig${type ? ' — ' + type : ''}`);

        const sections = this.clearSections();
        sections.camera.innerHTML = Flights.renderHTML(ac);
        Flights.loadRoute(ac);

        if (ac.lat && ac.lon) {
            this.loadWeather(ac.lat, ac.lon, sections.weather);
        }
    },

    async onCastleClick(castle) {
        this.openPanel();
        this.setPanelHeader(castle.name, Castles.typeLabel(castle.type) + (castle.period ? ' — ' + castle.period : ''));

        const sections = this.clearSections();
        sections.camera.innerHTML = '<div class="loading">Wikipedia laden...</div>';

        const wiki = await Castles.fetchWiki(castle.wiki);
        sections.camera.innerHTML = Castles.renderHTML(castle, wiki);

        this.loadWeather(castle.lat, castle.lon, sections.weather);
        this.loadSunTimes(castle.lat, castle.lon, sections.sun);
    },

    async showLocationInfo(lat, lon) {
        if (!this.isChecked('layer-weather')) return;
        this.openPanel();
        this.setPanelHeader(`${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'Locatie');

        const sections = this.clearSections();
        this.loadWeather(lat, lon, sections.weather);
        this.loadSunTimes(lat, lon, sections.sun);
    },

    setPanelHeader(title, subtitle) {
        document.getElementById('panel-title').textContent = title;
        document.getElementById('panel-subtitle').textContent = subtitle || '';
    },

    clearSections() {
        const weather = document.getElementById('panel-weather');
        const sun = document.getElementById('panel-sun');
        const camera = document.getElementById('camera-container');

        weather.innerHTML = '';
        sun.innerHTML = '';
        camera.innerHTML = '';

        return { weather, sun, camera };
    },

    loadWeather(lat, lon, el) {
        if (!el) return;
        el.innerHTML = '<div class="loading">Weer laden...</div>';
        Weather.fetch(lat, lon)
            .then(w => { el.innerHTML = Weather.renderHTML(w); })
            .catch(() => { el.innerHTML = ''; });
    },

    async loadSunTimes(lat, lon, el) {
        if (!el) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await fetch(`https://api.sunrisesunset.io/json?lat=${lat}&lng=${lon}&date=${today}&time_format=24`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            if (data.status === 'OK') {
                const r = data.results;
                el.innerHTML = `
                    <h3>Zon</h3>
                    <div class="sun-times">
                        <div class="sun-item">
                            <span class="value">&#9728; ${r.sunrise}</span>
                            <span class="label">Opgang</span>
                        </div>
                        <div class="sun-item golden">
                            <span class="value">&#9788; ${r.golden_hour}</span>
                            <span class="label">Golden hour</span>
                        </div>
                        <div class="sun-item">
                            <span class="value">&#9790; ${r.sunset}</span>
                            <span class="label">Ondergang</span>
                        </div>
                    </div>
                `;
            }
        } catch {
            if (el) el.innerHTML = '';
        }
    },

    refreshCamera() {
        if (!this.currentCamera) return;
        const cameraEl = document.getElementById('camera-container');
        cameraEl.innerHTML = '<div class="loading">Verversing...</div>';
        setTimeout(() => {
            cameraEl.innerHTML = Cameras.renderCamera(this.currentCamera);
        }, 200);
    },

    openPanel() {
        document.getElementById('panel').classList.add('open');
        this.panelOpen = true;
    },

    closePanel() {
        document.getElementById('panel').classList.remove('open');
        this.panelOpen = false;
        Cameras.stopLive();
        if (this.currentCamera) {
            Cameras.requestDesktop(this.currentCamera, 'stop_live');
        }
        this.currentCamera = null;
    },

    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        try {
            const reg = await navigator.serviceWorker.register('sw.js');
            reg.addEventListener('updatefound', () => {
                const newSW = reg.installing;
                if (!newSW) return;
                newSW.addEventListener('statechange', () => {
                    if (newSW.state === 'activated' && navigator.serviceWorker.controller) {
                        window.location.reload();
                    }
                });
            });
        } catch (e) {
            console.warn('SW registratie mislukt:', e);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
