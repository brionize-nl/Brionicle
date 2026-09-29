const App = {
    map: null,
    cameras: [],
    currentCamera: null,
    panelOpen: false,

    async init() {
        this.initMap();
        this.initPanel();
        this.initLayers();
        this.initRoadtrip();
        this.initLocate();

        Cameras.init(this.map);
        Earthquakes.init(this.map);
        ISS.init(this.map);
        Pins.init(this.map);
        UFO.init(this.map);
        Roadtrip.init(this.map);
        RainRadar.init(this.map);
        Flights.init(this.map);

        await Promise.all([
            this.loadCameras(),
            Pins.loadAll(),
            this.loadEarthquakes(),
            UFO.load()
        ]);

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

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19
        }).addTo(this.map);

        this.map.on('click', (e) => {
            if (Roadtrip.handleMapClick(e.latlng)) return;
            if (!this.panelOpen) {
                this.showLocationInfo(e.latlng.lat, e.latlng.lng);
            }
        });
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
            'layer-earthquakes': (on) => on ? Earthquakes.show((q) => this.onQuakeClick(q)) : Earthquakes.hide(),
            'layer-iss': (on) => on ? ISS.show((p) => this.onISSClick(p)) : ISS.hide(),
            'layer-ufo': (on) => on ? UFO.show((u) => this.onUFOClick(u)) : UFO.hide(),
            'layer-flights': (on) => on ? Flights.show() : Flights.hide(),
            'layer-rainradar': (on) => on ? RainRadar.show() : RainRadar.hide(),
            'layer-festivals': (on) => on ? Pins.showLayer('festivals', (p) => this.onPinClick(p)) : Pins.hideLayer('festivals'),
            'layer-monuments': (on) => on ? Pins.showLayer('monuments', (p) => this.onPinClick(p)) : Pins.hideLayer('monuments'),
            'layer-telescopes': (on) => on ? Pins.showLayer('telescopes', (p) => this.onPinClick(p)) : Pins.hideLayer('telescopes'),
            'layer-livecams': (on) => on ? Pins.showLayer('livecams', (p) => this.onPinClick(p)) : Pins.hideLayer('livecams'),
            'layer-urban': (on) => on ? Pins.showLayer('urban', (p) => this.onPinClick(p)) : Pins.hideLayer('urban'),
            'layer-caves': (on) => on ? Pins.showLayer('caves', (p) => this.onPinClick(p)) : Pins.hideLayer('caves'),
            'layer-roadtrip': (on) => on ? Roadtrip.show() : Roadtrip.hide()
        };

        Object.entries(layerHandlers).forEach(([id, handler]) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', (e) => handler(e.target.checked));
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

    initRoadtrip() {
        document.getElementById('rt-start').addEventListener('click', () => Roadtrip.startPicking('start'));
        document.getElementById('rt-end').addEventListener('click', () => Roadtrip.startPicking('end'));
        document.getElementById('rt-clear').addEventListener('click', () => Roadtrip.clear());
        document.getElementById('rt-close').addEventListener('click', () => {
            document.getElementById('layer-roadtrip').checked = false;
            Roadtrip.hide();
        });
    },

    showActiveLayers() {
        if (this.isChecked('layer-cameras')) Cameras.show(this.cameras, this.map, (c) => this.onCameraClick(c));
        if (this.isChecked('layer-earthquakes')) Earthquakes.show((q) => this.onQuakeClick(q));
        if (this.isChecked('layer-iss')) ISS.show((p) => this.onISSClick(p));
        if (this.isChecked('layer-ufo')) UFO.show((u) => this.onUFOClick(u));
        if (this.isChecked('layer-flights')) Flights.show();
        if (this.isChecked('layer-rainradar')) RainRadar.show();
        if (this.isChecked('layer-festivals')) Pins.showLayer('festivals', (p) => this.onPinClick(p));
        if (this.isChecked('layer-monuments')) Pins.showLayer('monuments', (p) => this.onPinClick(p));
        if (this.isChecked('layer-telescopes')) Pins.showLayer('telescopes', (p) => this.onPinClick(p));
        if (this.isChecked('layer-livecams')) Pins.showLayer('livecams', (p) => this.onPinClick(p));
        if (this.isChecked('layer-urban')) Pins.showLayer('urban', (p) => this.onPinClick(p));
        if (this.isChecked('layer-caves')) Pins.showLayer('caves', (p) => this.onPinClick(p));
    },

    isChecked(id) {
        const el = document.getElementById(id);
        return el && el.checked;
    },

    async loadCameras() {
        this.cameras = await Cameras.loadRWS();
        console.log(`${this.cameras.length} camera's geladen`);
    },

    async loadEarthquakes() {
        const count = await Earthquakes.load();
        console.log(`${count} aardbevingen geladen`);
    },

    onCameraClick(cam) {
        this.currentCamera = cam;
        this.openPanel();
        this.setPanelHeader(cam.name, [cam.road, cam.source].filter(Boolean).join(' — '));

        const sections = this.clearSections();
        sections.camera.innerHTML = Cameras.renderCamera(cam);
        this.loadWeather(cam.lat, cam.lon, sections.weather);
        this.loadSunTimes(cam.lat, cam.lon, sections.sun);
        this.loadAurora(cam.lat, sections.extra);
        this.loadWikipedia(cam.lat, cam.lon);
    },

    onQuakeClick(quake) {
        this.openPanel();
        this.setPanelHeader(quake.place, 'Aardbeving');

        const sections = this.clearSections();
        sections.camera.innerHTML = Earthquakes.renderHTML(quake);
        this.loadWeather(quake.lat, quake.lon, sections.weather);
        this.loadSunTimes(quake.lat, quake.lon, sections.sun);
    },

    onISSClick(pos) {
        this.openPanel();
        this.setPanelHeader('International Space Station', 'ISS');

        const sections = this.clearSections();
        sections.camera.innerHTML = ISS.renderHTML(pos);
    },

    onUFOClick(sighting) {
        this.openPanel();
        this.setPanelHeader(sighting.city, 'UFO Melding');

        const sections = this.clearSections();
        sections.camera.innerHTML = UFO.renderHTML(sighting);
        this.loadWeather(sighting.lat, sighting.lon, sections.weather);
        this.loadWikipedia(sighting.lat, sighting.lon);
    },

    onPinClick(item) {
        this.openPanel();
        const typeLabel = Pins.TYPES[item.type]?.label || item.type;
        this.setPanelHeader(item.name, `${typeLabel} — ${item.country}`);

        const sections = this.clearSections();

        if (item.youtubeChannel) {
            sections.camera.innerHTML = Pins.renderYouTube(item) + Pins.renderHTML(item);
        } else {
            sections.camera.innerHTML = Pins.renderHTML(item);
        }

        this.loadWeather(item.lat, item.lon, sections.weather);
        this.loadSunTimes(item.lat, item.lon, sections.sun);
        this.loadAurora(item.lat, sections.extra);
        this.loadWikipedia(item.lat, item.lon);
        this.loadRadio(item.lat, item.lon);
    },

    async showLocationInfo(lat, lon) {
        if (!this.isChecked('layer-weather')) return;
        this.openPanel();
        this.setPanelHeader(`${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'Locatie');

        const sections = this.clearSections();
        this.loadWeather(lat, lon, sections.weather);
        this.loadSunTimes(lat, lon, sections.sun);
        this.loadAurora(lat, sections.extra);
        this.loadWikipedia(lat, lon);
        this.loadRadio(lat, lon);
    },

    setPanelHeader(title, subtitle) {
        document.getElementById('panel-title').textContent = title;
        document.getElementById('panel-subtitle').textContent = subtitle || '';
    },

    clearSections() {
        const weather = document.getElementById('panel-weather');
        const sun = document.getElementById('panel-sun');
        const camera = document.getElementById('camera-container');
        const extra = document.getElementById('panel-extra');
        const wiki = document.getElementById('panel-wiki');
        const radio = document.getElementById('panel-radio');

        weather.innerHTML = '';
        sun.innerHTML = '';
        camera.innerHTML = '';
        if (extra) extra.innerHTML = '';
        if (wiki) wiki.innerHTML = '';
        if (radio) radio.innerHTML = '';

        return { weather, sun, camera, extra, wiki, radio };
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

    async loadAurora(lat, el) {
        if (!el) return;
        try {
            const html = await Aurora.renderHTML(lat);
            el.innerHTML = html;
        } catch {
            el.innerHTML = '';
        }
    },

    async loadWikipedia(lat, lon) {
        const el = document.getElementById('panel-wiki');
        if (!el) return;
        try {
            const articles = await Wikipedia.fetch(lat, lon);
            el.innerHTML = Wikipedia.renderHTML(articles);
        } catch {
            el.innerHTML = '';
        }
    },

    async loadRadio(lat, lon) {
        const el = document.getElementById('panel-radio');
        if (!el) return;
        try {
            const stations = await Radio.fetchNearby(lat, lon);
            el.innerHTML = Radio.renderHTML(stations);
        } catch {
            el.innerHTML = '';
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
        this.currentCamera = null;
        Radio.stop();
    },

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try { await navigator.serviceWorker.register('sw.js'); }
            catch (e) { console.warn('SW registratie mislukt:', e); }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
