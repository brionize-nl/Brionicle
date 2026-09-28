const ISS = {
    marker: null,
    trail: null,
    trailCoords: [],
    updateInterval: null,
    map: null,

    NASA_STREAMS: [
        { name: 'NASA TV Public', url: 'https://www.youtube.com/embed/P9C25Un7xaM?autoplay=1' },
        { name: 'NASA TV Media', url: 'https://www.youtube.com/embed/21X5lGlDOfg?autoplay=1' }
    ],

    init(map) {
        this.map = map;
    },

    async getPosition() {
        const res = await fetch('https://api.open-notify.org/iss-now.json');
        if (!res.ok) throw new Error();
        const data = await res.json();
        return {
            lat: parseFloat(data.iss_position.latitude),
            lon: parseFloat(data.iss_position.longitude),
            timestamp: data.timestamp
        };
    },

    async show(onISSClick) {
        try {
            const pos = await this.getPosition();
            this.addMarker(pos, onISSClick);
            this.startTracking(onISSClick);
        } catch {
            console.warn('ISS positie niet beschikbaar');
        }
    },

    addMarker(pos, onClick) {
        if (this.marker) {
            this.marker.setLatLng([pos.lat, pos.lon]);
        } else {
            this.marker = L.marker([pos.lat, pos.lon], {
                icon: L.divIcon({
                    className: 'iss-marker',
                    html: '<div class="iss-icon">&#128752;</div>',
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                })
            });
            this.marker.bindTooltip('ISS — International Space Station', {
                direction: 'top',
                offset: [0, -14],
                className: 'camera-tooltip'
            });
            if (onClick) {
                this.marker.on('click', () => onClick(pos));
            }
            this.marker.addTo(this.map);
        }

        this.trailCoords.push([pos.lat, pos.lon]);
        if (this.trailCoords.length > 60) this.trailCoords.shift();

        if (this.trail) {
            this.trail.setLatLngs(this.trailCoords);
        } else {
            this.trail = L.polyline(this.trailCoords, {
                color: '#4fc3f7',
                weight: 2,
                opacity: 0.4,
                dashArray: '4 6'
            }).addTo(this.map);
        }
    },

    startTracking(onClick) {
        this.stopTracking();
        this.updateInterval = setInterval(async () => {
            try {
                const pos = await this.getPosition();
                this.addMarker(pos, onClick);
            } catch {}
        }, 5000);
    },

    stopTracking() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    },

    hide() {
        this.stopTracking();
        if (this.marker) {
            this.map.removeLayer(this.marker);
            this.marker = null;
        }
        if (this.trail) {
            this.map.removeLayer(this.trail);
            this.trail = null;
        }
        this.trailCoords = [];
    },

    renderHTML(pos) {
        const streams = this.NASA_STREAMS.map(s =>
            `<div style="margin-bottom:8px;">
                <p style="font-size:12px;color:var(--text-dim);margin-bottom:4px;">${s.name}</p>
                <iframe src="${s.url}" width="100%" height="200" frameborder="0" allowfullscreen style="border-radius:6px;background:#000;" loading="lazy"></iframe>
            </div>`
        ).join('');

        return `
            <h3>ISS Live</h3>
            <div class="weather-grid">
                <div class="weather-item">
                    <span class="value">${pos.lat.toFixed(2)}°</span>
                    <span class="label">Latitude</span>
                </div>
                <div class="weather-item">
                    <span class="value">${pos.lon.toFixed(2)}°</span>
                    <span class="label">Longitude</span>
                </div>
            </div>
            <p style="font-size:12px;color:var(--text-dim);margin-top:8px;">Snelheid: ~27.600 km/u | Hoogte: ~408 km</p>
            <div style="margin-top:12px;">${streams}</div>
        `;
    }
};
