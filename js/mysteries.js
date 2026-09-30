const Mysteries = {
    data: [],
    markers: L.layerGroup(),
    map: null,

    init(map) {
        this.map = map;
    },

    async load() {
        const res = await fetch('data/mysteries.json');
        this.data = await res.json();
        return this.data;
    },

    show(onClick) {
        this.markers.clearLayers();
        this.data.forEach(m => {
            const icon = L.divIcon({
                className: 'mystery-marker-wrap',
                html: this.iconSVG(m.type),
                iconSize: [18, 22],
                iconAnchor: [9, 22]
            });
            const marker = L.marker([m.lat, m.lon], { icon });
            marker.bindTooltip(m.name, {
                direction: 'top', offset: [0, -22], className: 'camera-tooltip'
            });
            marker.on('click', () => onClick(m));
            this.markers.addLayer(marker);
        });
        this.markers.addTo(this.map);
    },

    hide() {
        this.markers.clearLayers();
        if (this.map) this.map.removeLayer(this.markers);
    },

    iconSVG(type) {
        if (type === 'loge') {
            return `<svg viewBox="0 0 18 20" width="18" height="20">
                <polygon points="9,2 17,18 1,18" fill="none" stroke="#8b6914" stroke-width="1.5"/>
                <circle cx="9" cy="12" r="3" fill="#8b6914"/>
                <circle cx="9" cy="12" r="1.2" fill="#2c1e0f"/>
            </svg>`;
        }
        return `<svg viewBox="0 0 16 20" width="16" height="20">
            <path d="M8,2 C12,6 14,10 14,14 C14,17 11,19 8,19 C5,19 2,17 2,14 C2,10 4,6 8,2 Z" fill="#6b4c7a" opacity="0.85"/>
            <path d="M8,7 C10,9 11,11 11,14 C11,16 9.5,17 8,17 C6.5,17 5,16 5,14 C5,11 6,9 8,7 Z" fill="#9b7cb0" opacity="0.5"/>
        </svg>`;
    },

    typeLabel(type) {
        return type === 'loge' ? 'Vrijmetselaarsloge' : 'Paranormale locatie';
    },

    async fetchWiki(pageName) {
        if (!pageName) return null;
        try {
            const res = await fetch(`https://nl.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageName)}`);
            if (!res.ok) {
                const enRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageName)}`);
                if (!enRes.ok) return null;
                return await enRes.json();
            }
            return await res.json();
        } catch {
            return null;
        }
    },

    renderHTML(mystery, wiki) {
        let html = '';

        if (wiki && wiki.thumbnail) {
            html += `<img src="${wiki.thumbnail.source}" alt="${mystery.name}" style="width:100%;border-radius:6px;margin-bottom:12px;">`;
        }

        html += '<div class="mystery-info">';
        html += `<span class="mystery-badge ${mystery.type}">${this.typeLabel(mystery.type)}</span>`;
        if (mystery.period) html += `<span class="castle-period">${mystery.period}</span>`;

        const text = (wiki && wiki.extract) || mystery.description || '';
        if (text) html += `<p class="castle-extract">${text}</p>`;

        if (mystery.wiki) {
            html += `<a href="https://nl.wikipedia.org/wiki/${mystery.wiki}" target="_blank" rel="noopener" class="castle-link">Wikipedia</a>`;
        }

        html += '</div>';
        return html;
    }
};
