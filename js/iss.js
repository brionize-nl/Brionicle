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
        this.lastPos = pos;
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
                this.marker.on('click', () => onClick(this.lastPos));
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
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                <span style="font-size:36px;">&#128752;</span>
                <div>
                    <div style="font-size:18px;font-weight:700;">International Space Station</div>
                    <div style="font-size:12px;color:var(--text-dim);">Live positie en NASA TV</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
                <div>
                    <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Positie</span>
                    <div style="font-size:16px;font-weight:600;font-family:monospace;">${pos.lat.toFixed(2)}° / ${pos.lon.toFixed(2)}°</div>
                </div>
                <div>
                    <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Snelheid</span>
                    <div style="font-size:16px;font-weight:600;">27.600 km/u</div>
                </div>
                <div>
                    <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Hoogte</span>
                    <div style="font-size:16px;font-weight:600;">~408 km</div>
                </div>
                <div>
                    <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Omlooptijd</span>
                    <div style="font-size:16px;font-weight:600;">~92 min</div>
                </div>
            </div>
            <div style="margin-top:12px;">${streams}</div>
        `;
    }
};
