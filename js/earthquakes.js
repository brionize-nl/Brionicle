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
        const tsunamiText = quake.tsunami ? '<span style="color:var(--warning);">Tsunami waarschuwing</span>' : 'Geen tsunami waarschuwing';

        return `
            <h3>Aardbeving</h3>
            <div class="weather-grid">
                <div class="weather-item">
                    <span class="value">${quake.magnitude.toFixed(1)}</span>
                    <span class="label">Magnitude</span>
                </div>
                <div class="weather-item">
                    <span class="value">${quake.depth.toFixed(0)} km</span>
                    <span class="label">Diepte</span>
                </div>
            </div>
            <p style="font-size:13px;color:var(--text);margin-top:8px;">${quake.place}</p>
            <p style="font-size:12px;color:var(--text-dim);margin-top:4px;">${timeStr}</p>
            <p style="font-size:12px;margin-top:4px;">${tsunamiText}</p>
            <a href="${quake.url}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;font-size:12px;color:var(--accent);text-decoration:none;">Meer info (USGS) &rarr;</a>
        `;
    }
};
