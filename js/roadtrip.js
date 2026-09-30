const Roadtrip = {
    map: null,
    routeLayer: null,
    startMarker: null,
    endMarker: null,
    picking: null,

    init(map) {
        this.map = map;
        this.routeLayer = L.layerGroup().addTo(map);
    },

    show() {
        const panel = document.getElementById('roadtrip-panel');
        if (panel) panel.classList.remove('hidden');
    },

    hide() {
        const panel = document.getElementById('roadtrip-panel');
        if (panel) panel.classList.add('hidden');
        this.clear();
    },

    clear() {
        this.routeLayer.clearLayers();
        if (this.startMarker) { this.map.removeLayer(this.startMarker); this.startMarker = null; }
        if (this.endMarker) { this.map.removeLayer(this.endMarker); this.endMarker = null; }
        this.picking = null;
        document.getElementById('rt-start-text').textContent = 'Klik op kaart...';
        document.getElementById('rt-end-text').textContent = 'Klik op kaart...';
        document.getElementById('rt-info').innerHTML = '';
    },

    startPicking(type) {
        this.picking = type;
        this.map.getContainer().style.cursor = 'crosshair';
        const label = type === 'start' ? 'Klik op de kaart voor startpunt' : 'Klik op de kaart voor eindpunt';
        document.getElementById('rt-info').innerHTML = `<p style="font-size:12px;color:var(--accent);">${label}</p>`;
    },

    handleMapClick(latlng) {
        if (!this.picking) return false;

        const type = this.picking;
        this.picking = null;
        this.map.getContainer().style.cursor = '';

        const color = type === 'start' ? '#66bb6a' : '#ef5350';
        const label = type === 'start' ? 'Start' : 'Einde';

        if (type === 'start') {
            if (this.startMarker) this.map.removeLayer(this.startMarker);
            this.startMarker = this.createPointMarker(latlng, color, label);
            document.getElementById('rt-start-text').textContent = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
        } else {
            if (this.endMarker) this.map.removeLayer(this.endMarker);
            this.endMarker = this.createPointMarker(latlng, color, label);
            document.getElementById('rt-end-text').textContent = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
        }

        if (this.startMarker && this.endMarker) {
            this.calculateRoute();
        } else {
            document.getElementById('rt-info').innerHTML = '';
        }

        return true;
    },

    createPointMarker(latlng, color, label) {
        const marker = L.circleMarker([latlng.lat, latlng.lng], {
            radius: 8,
            fillColor: color,
            fillOpacity: 0.9,
            color: '#fff',
            weight: 2
        });
        marker.bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -10], className: 'camera-tooltip' });
        marker.addTo(this.map);
        return marker;
    },

    async calculateRoute() {
        const info = document.getElementById('rt-info');
        info.innerHTML = '<p style="font-size:12px;color:var(--accent);">Route berekenen...</p>';

        const start = this.startMarker.getLatLng();
        const end = this.endMarker.getLatLng();

        const straightDist = this.haversine(start.lat, start.lng, end.lat, end.lng);

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true`;
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            if (!res.ok) throw new Error('Route niet gevonden');
            const data = await res.json();

            if (!data.routes || data.routes.length === 0) throw new Error('Geen route gevonden');

            const route = data.routes[0];
            this.drawRoute(route);

            const distKm = (route.distance / 1000).toFixed(0);
            const durMin = Math.round(route.duration / 60);
            const durH = Math.floor(durMin / 60);
            const durM = durMin % 60;
            const durStr = durH > 0 ? `${durH}u ${durM}min` : `${durM} min`;

            info.innerHTML = `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
                    <div>
                        <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Afstand</span>
                        <div style="font-size:20px;font-weight:700;">${distKm} km</div>
                    </div>
                    <div>
                        <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Rijtijd</span>
                        <div style="font-size:20px;font-weight:700;">${durStr}</div>
                    </div>
                </div>
            `;

            this.showPinsAlongRoute(route.geometry.coordinates);

        } catch (err) {
            this.routeLayer.clearLayers();
            L.polyline([[start.lat, start.lng], [end.lat, end.lng]], {
                color: '#4fc3f7', weight: 2, opacity: 0.5, dashArray: '8 8'
            }).addTo(this.routeLayer);

            const distKm = Math.round(straightDist);
            info.innerHTML = `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
                    <div>
                        <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Hemelsbreed</span>
                        <div style="font-size:20px;font-weight:700;">${distKm} km</div>
                    </div>
                    <div>
                        <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Status</span>
                        <div style="font-size:13px;color:var(--warning);">Route server niet bereikbaar</div>
                    </div>
                </div>
            `;
        }
    },

    drawRoute(route) {
        this.routeLayer.clearLayers();
        const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);

        L.polyline(coords, {
            color: '#4fc3f7',
            weight: 4,
            opacity: 0.8
        }).addTo(this.routeLayer);
    },

    showPinsAlongRoute(routeCoords) {
        const bufferKm = 15;
        let count = 0;

        const allPins = [
            ...(App.cameras || []).map(c => ({ ...c, _type: 'camera' })),
            ...(Pins.data.festivals || []).map(p => ({ ...p, _type: 'pin' })),
            ...(Pins.data.monuments || []).map(p => ({ ...p, _type: 'pin' })),
            ...(Pins.data.telescopes || []).map(p => ({ ...p, _type: 'pin' }))
        ];

        const samplePoints = [];
        const step = Math.max(1, Math.floor(routeCoords.length / 100));
        for (let i = 0; i < routeCoords.length; i += step) {
            samplePoints.push(routeCoords[i]);
        }

        allPins.forEach(pin => {
            const nearRoute = samplePoints.some(coord => {
                const dist = this.haversine(pin.lat, pin.lon, coord[1], coord[0]);
                return dist <= bufferKm;
            });

            if (nearRoute) {
                count++;
                const color = pin._type === 'camera' ? '#4fc3f7' : '#ffa726';
                const circle = L.circleMarker([pin.lat, pin.lon], {
                    radius: 5,
                    fillColor: color,
                    fillOpacity: 0.7,
                    color: color,
                    weight: 1
                });
                circle.bindTooltip(pin.name, { direction: 'top', className: 'camera-tooltip' });
                circle.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (pin._type === 'camera') {
                        App.onCameraClick(pin);
                    } else {
                        App.onPinClick(pin);
                    }
                });
                this.routeLayer.addLayer(circle);
            }
        });

        if (count > 0) {
            const info = document.getElementById('rt-info');
            info.innerHTML += `<p style="font-size:12px;color:var(--success);margin-top:4px;">${count} punt(en) langs de route</p>`;
        }
    },

    haversine(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
};
