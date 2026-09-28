const App = {
    map: null,
    cameras: [],
    currentCamera: null,
    panelOpen: false,

    async init() {
        this.initMap();
        this.initPanel();
        this.initLayers();
        await this.loadCameras();
        this.registerServiceWorker();
    },

    initMap() {
        this.map = L.map('map', {
            center: [52.1, 5.3],
            zoom: 8,
            zoomControl: true,
            attributionControl: true
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this.map);

        Cameras.init(this.map);

        this.map.on('click', (e) => {
            if (!this.panelOpen) {
                this.showLocationInfo(e.latlng.lat, e.latlng.lng);
            }
        });
    },

    initPanel() {
        const closeBtn = document.getElementById('panel-close');
        closeBtn.addEventListener('click', () => this.closePanel());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closePanel();
        });
    },

    initLayers() {
        const layersBtn = document.getElementById('layers-btn');
        const layersMenu = document.getElementById('layers-menu');

        layersBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            layersMenu.classList.toggle('hidden');
        });

        document.addEventListener('click', () => {
            layersMenu.classList.add('hidden');
        });

        document.getElementById('layer-cameras').addEventListener('change', (e) => {
            if (e.target.checked) {
                Cameras.show(this.cameras, this.map, (cam) => this.onCameraClick(cam));
            } else {
                Cameras.hide();
            }
        });
    },

    async loadCameras() {
        this.cameras = await Cameras.loadRWS();
        if (document.getElementById('layer-cameras').checked) {
            Cameras.show(this.cameras, this.map, (cam) => this.onCameraClick(cam));
        }
        console.log(`${this.cameras.length} camera's geladen`);
    },

    onCameraClick(cam) {
        this.currentCamera = cam;
        const title = document.getElementById('panel-title');
        const subtitle = document.getElementById('panel-subtitle');
        const weatherEl = document.getElementById('panel-weather');
        const sunEl = document.getElementById('panel-sun');
        const cameraEl = document.getElementById('camera-container');

        title.textContent = cam.name;
        subtitle.textContent = [cam.road, cam.source].filter(Boolean).join(' — ');

        weatherEl.innerHTML = '<div class="loading">Weer laden...</div>';
        sunEl.innerHTML = '';
        cameraEl.innerHTML = '<div class="loading">Beeld laden...</div>';

        this.openPanel();

        if (document.getElementById('layer-weather').checked) {
            Weather.fetch(cam.lat, cam.lon)
                .then(w => { weatherEl.innerHTML = Weather.renderHTML(w); })
                .catch(() => { weatherEl.innerHTML = '<div class="error">Weer niet beschikbaar</div>'; });
        } else {
            weatherEl.innerHTML = '';
        }

        this.loadSunTimes(cam.lat, cam.lon, sunEl);

        setTimeout(() => {
            cameraEl.innerHTML = Cameras.renderCamera(cam);
        }, 100);
    },

    async showLocationInfo(lat, lon) {
        const title = document.getElementById('panel-title');
        const subtitle = document.getElementById('panel-subtitle');
        const weatherEl = document.getElementById('panel-weather');
        const sunEl = document.getElementById('panel-sun');
        const cameraEl = document.getElementById('camera-container');

        title.textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        subtitle.textContent = 'Locatie';

        weatherEl.innerHTML = '<div class="loading">Weer laden...</div>';
        sunEl.innerHTML = '';
        cameraEl.innerHTML = '';

        this.openPanel();

        if (document.getElementById('layer-weather').checked) {
            Weather.fetch(lat, lon)
                .then(w => { weatherEl.innerHTML = Weather.renderHTML(w); })
                .catch(() => { weatherEl.innerHTML = '<div class="error">Weer niet beschikbaar</div>'; });
        } else {
            weatherEl.innerHTML = '';
        }

        this.loadSunTimes(lat, lon, sunEl);
    },

    async loadSunTimes(lat, lon, el) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await fetch(`https://api.sunrisesunset.io/json?lat=${lat}&lng=${lon}&date=${today}`);
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
        const panel = document.getElementById('panel');
        panel.classList.add('open');
        this.panelOpen = true;
    },

    closePanel() {
        const panel = document.getElementById('panel');
        panel.classList.remove('open');
        this.panelOpen = false;
        this.currentCamera = null;
    },

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('sw.js');
            } catch (e) {
                console.warn('Service Worker registratie mislukt:', e);
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
