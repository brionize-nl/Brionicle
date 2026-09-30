const Castles = {
    data: [],
    markers: L.layerGroup(),
    map: null,

    init(map) {
        this.map = map;
    },

    async load() {
        const res = await fetch('data/castles.json');
        this.data = await res.json();
        return this.data;
    },

    show(onClick) {
        this.markers.clearLayers();
        this.data.forEach(c => {
            const icon = L.divIcon({
                className: 'castle-marker-wrap',
                html: this.iconSVG(c.type),
                iconSize: [18, 22],
                iconAnchor: [9, 22]
            });
            const m = L.marker([c.lat, c.lon], { icon });
            m.bindTooltip(c.name, {
                direction: 'top', offset: [0, -22], className: 'camera-tooltip'
            });
            m.on('click', () => onClick(c));
            this.markers.addLayer(m);
        });
        this.markers.addTo(this.map);
    },

    hide() {
        this.markers.clearLayers();
        if (this.map) this.map.removeLayer(this.markers);
    },

    iconSVG(type) {
        const colors = {
            kasteel: '#6b4c12',
            paleis: '#8b6914',
            fort: '#4a5c2a',
            'ruïne': '#7a6548'
        };
        const fill = colors[type] || colors.kasteel;

        if (type === 'fort') {
            return `<svg viewBox="0 0 18 20" width="18" height="20">
                <polygon points="9,1 17,7 14,19 4,19 1,7" fill="${fill}" stroke="#3a2a18" stroke-width="0.8"/>
                <polygon points="9,5 13,8 11,15 7,15 5,8" fill="#d4c5a9" opacity="0.3"/>
            </svg>`;
        }
        if (type === 'ruïne') {
            return `<svg viewBox="0 0 18 22" width="18" height="22">
                <rect x="1" y="6" width="4" height="16" fill="${fill}" rx="0.5"/>
                <rect x="7" y="4" width="4" height="10" fill="${fill}" rx="0.5" opacity="0.7"/>
                <rect x="13" y="8" width="4" height="14" fill="${fill}" rx="0.5" opacity="0.5"/>
                <rect x="1" y="3" width="4" height="4" fill="${fill}"/>
                <rect x="13" y="5" width="4" height="4" fill="${fill}" opacity="0.5"/>
            </svg>`;
        }
        return `<svg viewBox="0 0 18 22" width="18" height="22">
            <rect x="2" y="8" width="14" height="14" fill="${fill}" rx="1"/>
            <rect x="1" y="4" width="4" height="6" fill="${fill}"/>
            <rect x="7" y="4" width="4" height="6" fill="${fill}"/>
            <rect x="13" y="4" width="4" height="6" fill="${fill}"/>
            <rect x="7" y="14" width="4" height="8" rx="2" fill="#3a2205" opacity="0.5"/>
        </svg>`;
    },

    typeLabel(type) {
        const labels = { kasteel: 'Kasteel', paleis: 'Paleis', fort: 'Fort / Vesting', 'ruïne': 'Ruïne' };
        return labels[type] || type;
    },

    async fetchWiki(pageName) {
        try {
            const res = await fetch(`https://nl.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageName)}`);
            if (!res.ok) return null;
            return await res.json();
        } catch {
            return null;
        }
    },

    renderHTML(castle, wiki) {
        let html = '';

        if (wiki && wiki.thumbnail) {
            html += `<img src="${wiki.thumbnail.source}" alt="${castle.name}" style="width:100%;border-radius:6px;margin-bottom:12px;">`;
        }

        html += '<div class="castle-info">';
        html += `<span class="castle-badge">${this.typeLabel(castle.type)}</span>`;
        if (castle.period) html += `<span class="castle-period">${castle.period}</span>`;

        if (wiki && wiki.extract) {
            html += `<p class="castle-extract">${wiki.extract}</p>`;
        }

        if (castle.wiki) {
            html += `<a href="https://nl.wikipedia.org/wiki/${castle.wiki}" target="_blank" rel="noopener" class="castle-link">Wikipedia</a>`;
        }

        html += '</div>';
        return html;
    }
};
