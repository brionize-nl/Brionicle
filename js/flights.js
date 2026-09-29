const Flights = {
    layerGroup: null,
    map: null,
    updateInterval: null,
    markers: new Map(),
    trackedHex: null,
    _onMove: null,
    _moveTimer: null,

    init(map) {
        this.map = map;
        this.layerGroup = L.layerGroup();
    },

    async show() {
        this.layerGroup.addTo(this.map);
        await this.update();
        this.startTracking();
    },

    hide() {
        this.stopTracking();
        this.trackedHex = null;
        this.markers.clear();
        this.layerGroup.clearLayers();
        this.map.removeLayer(this.layerGroup);
    },

    startTracking() {
        this.stopTracking();
        this.updateInterval = setInterval(() => this.update(), 5000);
        this._onMove = () => {
            if (this._moveTimer) clearTimeout(this._moveTimer);
            this._moveTimer = setTimeout(() => this.update(), 800);
        };
        this.map.on('moveend', this._onMove);
    },

    stopTracking() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        if (this._moveTimer) {
            clearTimeout(this._moveTimer);
            this._moveTimer = null;
        }
        if (this._onMove) {
            this.map.off('moveend', this._onMove);
            this._onMove = null;
        }
    },

    altitudeColor(alt) {
        if (typeof alt !== 'number') return '#aaa';
        const ft = alt;
        if (ft < 1000) return '#90a4ae';
        if (ft < 10000) return '#4fc3f7';
        if (ft < 25000) return '#ffb74d';
        if (ft < 35000) return '#ff7043';
        return '#e040fb';
    },

    headingLabel(deg) {
        if (typeof deg !== 'number') return '';
        const dirs = ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'];
        return dirs[Math.round(deg / 45) % 8];
    },

    async update() {
        try {
            const center = this.map.getCenter();
            const bounds = this.map.getBounds();
            const ne = bounds.getNorthEast();
            const distKm = center.distanceTo(ne) / 1000;
            const distNm = Math.min(Math.round(distKm / 1.852), 250);

            const url = `/api/flights?lat=${center.lat.toFixed(4)}&lon=${center.lng.toFixed(4)}&dist=${distNm}`;
            const res = await fetch(url);
            if (!res.ok) return;
            const data = await res.json();
            if (!data.ac) return;

            const activeHexes = new Set();

            data.ac.forEach(ac => {
                const lat = ac.lat;
                const lon = ac.lon;
                const hex = ac.hex;
                if (!lat || !lon || !hex || ac.alt_baro === 'ground') return;

                activeHexes.add(hex);
                const callsign = (ac.flight || '').trim();
                const alt = typeof ac.alt_baro === 'number' ? ac.alt_baro : null;
                const speed = ac.gs;
                const heading = ac.track;
                const rotation = heading || 0;
                const color = this.altitudeColor(alt);
                const isTracked = hex === this.trackedHex;

                const iconHtml = `<div style="transform:rotate(${rotation}deg);font-size:18px;color:${color};filter:drop-shadow(0 1px 3px rgba(0,0,0,0.8));line-height:1;">&#9992;</div>`;

                const altM = alt !== null ? Math.round(alt * 0.3048) : null;
                const speedKmh = speed ? Math.round(speed * 1.852) : null;
                const vRate = ac.baro_rate;
                const vLabel = vRate > 100 ? '&#8599;' : vRate < -100 ? '&#8600;' : '&#8594;';

                let tip = `<b>${callsign || hex.toUpperCase()}</b>`;
                if (ac.t) tip += ` <span style="opacity:0.7">${ac.t}</span>`;
                if (altM !== null) tip += `<br>${altM}m hoogte`;
                if (speedKmh) tip += ` | ${speedKmh} km/u ${vLabel}`;
                if (ac.r) tip += `<br>${ac.r}`;

                const existing = this.markers.get(hex);
                if (existing) {
                    existing.setLatLng([lat, lon]);
                    existing.setIcon(L.divIcon({
                        className: 'flight-marker' + (isTracked ? ' flight-marker-tracked' : ''),
                        html: iconHtml,
                        iconSize: [22, 22],
                        iconAnchor: [11, 11]
                    }));
                    existing.setTooltipContent(tip);
                    existing._flightData = ac;
                } else {
                    const marker = L.marker([lat, lon], {
                        icon: L.divIcon({
                            className: 'flight-marker' + (isTracked ? ' flight-marker-tracked' : ''),
                            html: iconHtml,
                            iconSize: [22, 22],
                            iconAnchor: [11, 11]
                        }),
                        zIndexOffset: isTracked ? 1000 : 0
                    });

                    marker.bindTooltip(tip, {
                        direction: 'top',
                        offset: [0, -12],
                        className: 'camera-tooltip'
                    });

                    marker._flightData = ac;
                    marker.on('click', (e) => {
                        L.DomEvent.stopPropagation(e);
                        this.onFlightClick(ac);
                    });

                    this.layerGroup.addLayer(marker);
                    this.markers.set(hex, marker);
                }
            });

            for (const [hex, marker] of this.markers) {
                if (!activeHexes.has(hex)) {
                    this.layerGroup.removeLayer(marker);
                    this.markers.delete(hex);
                    if (hex === this.trackedHex) this.trackedHex = null;
                }
            }

            if (this.trackedHex) {
                const tracked = this.markers.get(this.trackedHex);
                if (tracked) {
                    this.map.panTo(tracked.getLatLng(), { animate: true, duration: 1 });
                }
            }

        } catch (e) {
            console.warn('Flights update:', e.message);
        }
    },

    onFlightClick(ac) {
        if (typeof App !== 'undefined' && App.openPanel) {
            App.onFlightClick(ac);
        }
    },

    renderHTML(ac) {
        const callsign = (ac.flight || '').trim();
        const hex = (ac.hex || '').toUpperCase();
        const reg = ac.r || '';
        const type = ac.t || '';
        const alt = typeof ac.alt_baro === 'number' ? ac.alt_baro : null;
        const altM = alt !== null ? Math.round(alt * 0.3048) : null;
        const altFt = alt;
        const speed = ac.gs ? Math.round(ac.gs * 1.852) : null;
        const heading = ac.track;
        const headingDir = this.headingLabel(heading);
        const vRate = ac.baro_rate;
        const squawk = ac.squawk || '';
        const category = ac.category || '';
        const isTracked = ac.hex === this.trackedHex;

        let vRateText = '';
        if (typeof vRate === 'number') {
            const vRateMs = Math.round(vRate * 0.00508 * 10) / 10;
            if (vRate > 200) vRateText = `&#8599; Stijgend (${vRateMs} m/s)`;
            else if (vRate < -200) vRateText = `&#8600; Dalend (${Math.abs(vRateMs)} m/s)`;
            else vRateText = '&#8594; Vlak';
        }

        const color = this.altitudeColor(alt);
        const trackBtnStyle = isTracked
            ? 'background:#f44;border:1px solid #f44;color:#fff;'
            : 'background:var(--accent);border:1px solid var(--accent);color:#fff;';
        const trackLabel = isTracked ? '&#10006; Stop volgen' : '&#9737; Volgen';

        let html = '<div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:13px;">';

        if (callsign) html += `<span style="color:var(--text-dim);">Vlucht</span><span><b>${callsign}</b></span>`;
        if (reg) html += `<span style="color:var(--text-dim);">Registratie</span><span>${reg}</span>`;
        if (type) html += `<span style="color:var(--text-dim);">Type</span><span>${type}</span>`;
        html += `<span style="color:var(--text-dim);">ICAO</span><span style="font-family:monospace;font-size:12px;">${hex}</span>`;

        if (altM !== null) {
            html += `<span style="color:var(--text-dim);">Hoogte</span>
                <span><b style="color:${color}">${altM.toLocaleString('nl-NL')} m</b> <span style="opacity:0.6">(${altFt.toLocaleString('nl-NL')} ft)</span></span>`;
        }
        if (speed !== null) {
            html += `<span style="color:var(--text-dim);">Snelheid</span><span>${speed} km/u</span>`;
        }
        if (heading !== undefined) {
            html += `<span style="color:var(--text-dim);">Koers</span><span>${Math.round(heading)}&deg; ${headingDir}</span>`;
        }
        if (vRateText) {
            html += `<span style="color:var(--text-dim);">Verticaal</span><span>${vRateText}</span>`;
        }
        if (squawk) {
            const special = { '7500': 'Kaping', '7600': 'Comm. storing', '7700': 'Noodgeval' };
            const sqLabel = special[squawk] ? ` <b style="color:#f44;">${special[squawk]}!</b>` : '';
            html += `<span style="color:var(--text-dim);">Squawk</span><span style="font-family:monospace;">${squawk}${sqLabel}</span>`;
        }

        html += '</div>';

        html += `<div style="display:flex;gap:8px;margin-top:10px;">
            <button onclick="Flights.toggleTrack('${ac.hex}')"
                style="${trackBtnStyle}padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;">
                ${trackLabel}</button>
            <a href="https://globe.adsb.fi/?icao=${ac.hex}" target="_blank" rel="noopener"
                style="display:flex;align-items:center;font-size:11px;color:var(--accent);text-decoration:none;">
                Meer info &rarr;</a>
        </div>`;

        return html;
    },

    toggleTrack(hex) {
        if (this.trackedHex === hex) {
            this.trackedHex = null;
        } else {
            this.trackedHex = hex;
            const marker = this.markers.get(hex);
            if (marker) {
                this.map.panTo(marker.getLatLng(), { animate: true });
            }
        }

        const tracked = this.markers.get(this.trackedHex);
        if (tracked && tracked._flightData) {
            this.onFlightClick(tracked._flightData);
        }
    }
};
