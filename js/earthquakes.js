const Earthquakes = {
    layerGroup: null,
    data: null,

    init(map) {
        this.layerGroup = L.layerGroup();
        this.map = map;
    },

    async load() {
        try {
            const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
            if (!res.ok) throw new Error();
            this.data = await res.json();
            return this.data.features.length;
        } catch {
            this.data = null;
            return 0;
        }
    },

    show(onQuakeClick) {
        if (!this.data) return;
        this.layerGroup.clearLayers();

        this.data.features.forEach(f => {
            const [lon, lat, depth] = f.geometry.coordinates;
            const mag = f.properties.mag;
            const place = f.properties.place;
            const time = new Date(f.properties.time);

            const radius = Math.max(4, mag * 3);
            const color = mag >= 5 ? '#ef5350' : mag >= 4 ? '#ffa726' : '#ffee58';

            const circle = L.circleMarker([lat, lon], {
                radius: radius,
                fillColor: color,
                fillOpacity: 0.6,
                color: color,
                weight: 1,
                opacity: 0.8
            });

            circle.bindTooltip(`M${mag.toFixed(1)} — ${place}`, {
                direction: 'top',
                className: 'camera-tooltip'
            });

            circle.on('click', () => {
                if (onQuakeClick) {
                    onQuakeClick({
                        magnitude: mag,
                        place: place,
                        depth: depth,
                        time: time,
                        tsunami: f.properties.tsunami,
                        url: f.properties.url,
                        lat: lat,
                        lon: lon
                    });
                }
            });

            this.layerGroup.addLayer(circle);
        });

        this.layerGroup.addTo(this.map);
    },

    hide() {
        this.layerGroup.clearLayers();
        this.map.removeLayer(this.layerGroup);
    },

    renderHTML(quake) {
        const timeStr = quake.time.toLocaleString('nl-NL', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        const magColor = quake.magnitude >= 5 ? 'var(--error)' : quake.magnitude >= 4 ? 'var(--warning)' : '#ffee58';

        let html = `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <div style="width:52px;height:52px;border-radius:50%;background:${magColor}20;border:2px solid ${magColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <span style="font-size:22px;font-weight:800;color:${magColor};">${quake.magnitude.toFixed(1)}</span>
            </div>
            <div>
                <div style="font-size:16px;font-weight:700;">${quake.place}</div>
                <div style="font-size:12px;color:var(--text-dim);">${timeStr}</div>
            </div>
        </div>`;

        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
            <div>
                <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Diepte</span>
                <div style="font-size:18px;font-weight:700;">${quake.depth.toFixed(0)} km</div>
            </div>
            <div>
                <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Tsunami</span>
                <div style="font-size:14px;font-weight:600;color:${quake.tsunami ? 'var(--warning)' : 'var(--success)'};">${quake.tsunami ? '&#9888; Waarschuwing' : '&#10003; Geen'}</div>
            </div>
        </div>`;

        html += `<a href="${quake.url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;margin-top:4px;padding:8px 16px;background:var(--accent);color:#000;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">USGS Details &rarr;</a>`;

        return html;
    }
};
