const UFO = {
    layerGroup: null,
    data: [],
    map: null,

    init(map) {
        this.map = map;
        this.layerGroup = L.layerGroup();
    },

    async load() {
        try {
            const res = await fetch('data/ufo-sightings.json');
            if (!res.ok) return 0;
            this.data = await res.json();
            return this.data.length;
        } catch {
            return 0;
        }
    },

    show(onUFOClick) {
        if (!this.data.length) return;
        this.layerGroup.clearLayers();

        this.data.forEach(sighting => {
            const marker = L.marker([sighting.lat, sighting.lon], {
                icon: L.divIcon({
                    className: 'ufo-marker',
                    html: '<div style="font-size:18px;filter:drop-shadow(0 0 4px rgba(76,175,80,0.6));">&#128760;</div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })
            });

            marker.bindTooltip(`${sighting.city} — ${sighting.shape}`, {
                direction: 'top',
                offset: [0, -10],
                className: 'camera-tooltip'
            });

            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                if (onUFOClick) onUFOClick(sighting);
            });

            this.layerGroup.addLayer(marker);
        });

        this.layerGroup.addTo(this.map);
    },

    hide() {
        this.layerGroup.clearLayers();
        this.map.removeLayer(this.layerGroup);
    },

    renderHTML(sighting) {
        return `
            <h3>UFO Melding</h3>
            <div class="weather-grid">
                <div class="weather-item">
                    <span class="value">${sighting.shape}</span>
                    <span class="label">Vorm</span>
                </div>
                <div class="weather-item">
                    <span class="value">${sighting.duration}</span>
                    <span class="label">Duur</span>
                </div>
            </div>
            <p style="font-size:13px;color:var(--text);margin-top:8px;">${sighting.description}</p>
            <p style="font-size:12px;color:var(--text-dim);margin-top:4px;">${sighting.city}, ${sighting.country}</p>
            <p style="font-size:12px;color:var(--text-dim);">Datum: ${sighting.date}</p>
            <p style="font-size:11px;color:var(--text-dim);margin-top:4px;">Bron: ${sighting.source}</p>
        `;
    }
};
