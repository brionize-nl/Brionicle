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
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                <span style="font-size:36px;filter:drop-shadow(0 0 8px rgba(76,175,80,0.5));">&#128760;</span>
                <div>
                    <div style="font-size:16px;font-weight:700;">${sighting.city}</div>
                    <div style="font-size:12px;color:var(--text-dim);">${sighting.country} · ${sighting.date}</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
                <div>
                    <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Vorm</span>
                    <div style="font-size:16px;font-weight:600;">${sighting.shape}</div>
                </div>
                <div>
                    <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Duur</span>
                    <div style="font-size:16px;font-weight:600;">${sighting.duration}</div>
                </div>
            </div>
            <p style="font-size:13px;color:var(--text);line-height:1.5;margin-bottom:8px;">${sighting.description}</p>
            <div style="font-size:11px;color:var(--text-dim);">Bron: ${sighting.source}</div>
        `;
    }
};
