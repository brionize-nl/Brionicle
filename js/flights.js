const Flights = {
    layerGroup: null,
    map: null,
    updateInterval: null,

    init(map) {
        this.map = map;
        this.layerGroup = L.layerGroup();
    },

    async show() {
        this.layerGroup.addTo(this.map);
        await this.update();
        this.startTracking();
    },

    hide() {
        this.stopTracking();
        this.layerGroup.clearLayers();
        this.map.removeLayer(this.layerGroup);
    },

    startTracking() {
        this.stopTracking();
        this.updateInterval = setInterval(() => this.update(), 10000);
        this.map.on('moveend', this._onMove = () => this.update());
    },

    stopTracking() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        if (this._onMove) {
            this.map.off('moveend', this._onMove);
            this._onMove = null;
        }
    },

    async update() {
        try {
            const center = this.map.getCenter();
            const bounds = this.map.getBounds();
            const ne = bounds.getNorthEast();
            const distKm = center.distanceTo(ne) / 1000;
            const distNm = Math.min(Math.round(distKm / 1.852), 250);

            const url = `/api/flights?lat=${center.lat.toFixed(4)}&lon=${center.lng.toFixed(4)}&dist=${distNm}`;
            const res = await fetch(url);
            if (!res.ok) {
                console.warn('Flights API:', res.status);
                return;
            }
            const data = await res.json();
            if (!data.ac || !data.ac.length) return;

            this.layerGroup.clearLayers();

            data.ac.forEach(ac => {
                const lat = ac.lat;
                const lon = ac.lon;
                const callsign = (ac.flight || '').trim();
                const alt = ac.alt_baro;
                const speed = ac.gs;
                const heading = ac.track;

                if (!lat || !lon || alt === 'ground') return;

                const rotation = heading || 0;
                const marker = L.marker([lat, lon], {
                    icon: L.divIcon({
                        className: 'flight-marker',
                        html: `<div style="transform:rotate(${rotation}deg);font-size:16px;filter:drop-shadow(0 0 4px rgba(255,183,77,0.7));color:#ffb74d;">&#9992;</div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })
                });

                const altKm = (typeof alt === 'number') ? (alt * 0.3048 / 1000).toFixed(1) : '?';
                const speedKmh = speed ? Math.round(speed * 1.852) : '?';
                const reg = ac.r || '';
                const type = ac.t || '';
                let tooltip = `<b>${callsign || 'Onbekend'}</b>`;
                if (type) tooltip += ` (${type})`;
                tooltip += `<br>${altKm} km hoogte | ${speedKmh} km/u`;
                if (reg) tooltip += `<br>${reg}`;

                marker.bindTooltip(tooltip, {
                    direction: 'top',
                    offset: [0, -10],
                    className: 'camera-tooltip'
                });

                this.layerGroup.addLayer(marker);
            });
        } catch (e) {
            console.warn('Flights update mislukt:', e.message);
        }
    }
};
