const RainRadar = {
    tileLayer: null,
    map: null,
    timestamp: null,

    init(map) {
        this.map = map;
    },

    async show() {
        try {
            const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
            if (!res.ok) return;
            const data = await res.json();
            const radar = data.radar;
            if (!radar || !radar.past || radar.past.length === 0) return;

            this.timestamp = radar.past[radar.past.length - 1].path;
            this.tileLayer = L.tileLayer(
                `https://tilecache.rainviewer.com${this.timestamp}/256/{z}/{x}/{y}/2/1_1.png`,
                { opacity: 0.5, zIndex: 400 }
            ).addTo(this.map);
        } catch {
            console.warn('Regenradar niet beschikbaar');
        }
    },

    hide() {
        if (this.tileLayer) {
            this.map.removeLayer(this.tileLayer);
            this.tileLayer = null;
        }
    }
};
