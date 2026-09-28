const Pins = {
    layers: {},
    data: {},

    TYPES: {
        festival: { color: '#e040fb', icon: '&#9835;', label: 'Festivals & Events' },
        concert: { color: '#e040fb', icon: '&#9835;', label: 'Festivals & Events' },
        venue: { color: '#e040fb', icon: '&#9835;', label: 'Festivals & Events' },
        kasteel: { color: '#ffb74d', icon: '&#9962;', label: 'Monumenten' },
        monument: { color: '#ffb74d', icon: '&#9962;', label: 'Monumenten' },
        museum: { color: '#ffb74d', icon: '&#9962;', label: 'Monumenten' },
        natuur: { color: '#66bb6a', icon: '&#9670;', label: 'Natuur' },
        telescoop: { color: '#90caf9', icon: '&#9733;', label: 'Telescopen' },
        radiotelescoop: { color: '#90caf9', icon: '&#9733;', label: 'Telescopen' },
        ruimtetelescoop: { color: '#90caf9', icon: '&#9733;', label: 'Telescopen' }
    },

    init(map) {
        this.map = map;
        this.layers = {
            festivals: L.layerGroup(),
            monuments: L.layerGroup(),
            telescopes: L.layerGroup()
        };
    },

    async loadAll() {
        const [festivals, monuments, telescopes] = await Promise.all([
            this.fetchJSON('data/festivals.json'),
            this.fetchJSON('data/monuments.json'),
            this.fetchJSON('data/telescopes.json')
        ]);
        this.data.festivals = festivals || [];
        this.data.monuments = monuments || [];
        this.data.telescopes = telescopes || [];
    },

    async fetchJSON(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) return [];
            return await res.json();
        } catch {
            return [];
        }
    },

    showLayer(layerName, onPinClick) {
        const layer = this.layers[layerName];
        if (!layer) return;
        layer.clearLayers();

        const items = this.data[layerName] || [];
        items.forEach(item => {
            const typeInfo = this.TYPES[item.type] || { color: '#aaa', icon: '&#9679;' };

            const marker = L.marker([item.lat, item.lon], {
                icon: L.divIcon({
                    className: 'pin-marker',
                    html: `<div style="
                        width:14px;height:14px;
                        background:${typeInfo.color};
                        border:2px solid #fff;
                        border-radius:50%;
                        box-shadow:0 0 6px ${typeInfo.color}80;
                        cursor:pointer;
                    "></div>`,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7]
                })
            });

            marker.bindTooltip(item.name, {
                direction: 'top',
                offset: [0, -8],
                className: 'camera-tooltip'
            });

            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                if (onPinClick) onPinClick(item);
            });

            layer.addLayer(marker);
        });

        layer.addTo(this.map);
    },

    hideLayer(layerName) {
        const layer = this.layers[layerName];
        if (layer) {
            layer.clearLayers();
            this.map.removeLayer(layer);
        }
    },

    renderHTML(item) {
        const typeInfo = this.TYPES[item.type] || {};
        const parts = [];

        if (item.description) {
            parts.push(`<p style="font-size:13px;color:var(--text);margin-bottom:8px;">${item.description}</p>`);
        }

        if (item.dates) {
            parts.push(`<p style="font-size:12px;color:var(--text-dim);">Datum: ${item.dates}</p>`);
        }

        if (item.genre) {
            parts.push(`<p style="font-size:12px;color:var(--text-dim);">Genre: ${item.genre}</p>`);
        }

        if (item.website) {
            parts.push(`<a href="${item.website}" target="_blank" rel="noopener" style="display:inline-block;margin-top:4px;font-size:12px;color:var(--accent);text-decoration:none;">Website &rarr;</a>`);
        }

        if (item.webcamUrl) {
            parts.push(`<a href="${item.webcamUrl}" target="_blank" rel="noopener" style="display:inline-block;margin-top:4px;font-size:12px;color:var(--accent);text-decoration:none;">Webcam &rarr;</a>`);
        }

        return `<h3>${typeInfo.label || item.type}</h3>${parts.join('')}`;
    },

    renderYouTube(item) {
        if (!item.youtubeChannel) return '';

        return `
            <h3>Video</h3>
            <p style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">Laatste video's van dit kanaal</p>
            <a href="https://www.youtube.com/@${item.youtubeChannel || ''}" target="_blank" rel="noopener" style="font-size:12px;color:var(--accent);text-decoration:none;">YouTube kanaal openen &rarr;</a>
            <div id="yt-videos" style="margin-top:8px;"></div>
        `;
    }
};
