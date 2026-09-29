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
        this.updateInterval = setInterval(() => this.update(), 15000);
    },

    stopTracking() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    },

    async update() {
        try {
            const bounds = this.map.getBounds();
            const url = `https://opensky-network.org/api/states/all?lamin=${bounds.getSouth().toFixed(2)}&lomin=${bounds.getWest().toFixed(2)}&lamax=${bounds.getNorth().toFixed(2)}&lomax=${bounds.getEast().toFixed(2)}`;
            const res = await fetch(url);
            if (!res.ok) return;
            const data = await res.json();
            if (!data.states) return;

            this.layerGroup.clearLayers();

            data.states.forEach(s => {
                const callsign = (s[1] || '').trim();
                const lon = s[5];
                const lat = s[6];
                const alt = s[7];
                const speed = s[9];
                const heading = s[10];
                const onGround = s[8];

                if (!lat || !lon || onGround) return;

                const rotation = heading || 0;
                const marker = L.marker([lat, lon], {
                    icon: L.divIcon({
                        className: 'flight-marker',
                        html: `<div style="transform:rotate(${rotation}deg);font-size:14px;filter:drop-shadow(0 0 3px rgba(255,183,77,0.6));">&#9992;</div>`,
                        iconSize: [18, 18],
                        iconAnchor: [9, 9]
                    })
                });

                const altKm = alt ? (alt / 1000).toFixed(1) : '?';
                const speedKmh = speed ? Math.round(speed * 3.6) : '?';
                marker.bindTooltip(
                    `${callsign || 'Onbekend'}<br>${altKm} km | ${speedKmh} km/u`,
                    { direction: 'top', offset: [0, -10], className: 'camera-tooltip' }
                );

                this.layerGroup.addLayer(marker);
            });
        } catch {}
    }
};
