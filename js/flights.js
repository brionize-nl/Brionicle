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
        this.updateInterval = setInterval(() => this.update(), 10000);
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

    classifyAircraft(ac) {
        const flags = ac.dbFlags || 0;
        if (flags & 1) return { label: 'Militair', color: '#ef5350', icon: '&#9733;' };

        const cat = (ac.category || '').toUpperCase();
        if (cat === 'A7') return { label: 'Helikopter', color: '#ce93d8', icon: '&#128681;' };
        if (cat === 'B2') return { label: 'Luchtballon', color: '#ffcc02', icon: '&#127880;' };
        if (cat === 'B1' || cat === 'B4') return { label: 'Zweefvliegtuig', color: '#90caf9', icon: '&#9978;' };
        if (cat === 'B6') return { label: 'Drone/UAV', color: '#ff9800', icon: '&#128296;' };
        if (cat === 'A5') return { label: 'Zwaar vliegtuig', color: '#e040fb', icon: '&#9992;' };
        if (cat === 'A3' || cat === 'A4') return { label: 'Lijnvlucht', color: '#4fc3f7', icon: '&#9992;' };
        if (cat === 'A2') return { label: 'Zakenvlucht', color: '#81c784', icon: '&#9992;' };
        if (cat === 'A1') return { label: 'Licht vliegtuig', color: '#ffb74d', icon: '&#9992;' };

        const type = (ac.t || '').toUpperCase();
        if (/^(B7[3-8]|A3[0-2]|A3[4-5]|B78|A22|E[1-2][7-9])/.test(type)) return { label: 'Lijnvlucht', color: '#4fc3f7', icon: '&#9992;' };
        if (/^(C130|C17|F16|F35|KC|C5|B52|A400|NH90|CH47|AH64|EUFI)/.test(type)) return { label: 'Militair', color: '#ef5350', icon: '&#9733;' };
        if (/^(C1[5-8]|C2[0-1]|PA|SR2|TB|DA[2-4]|DR4|P28)/.test(type)) return { label: 'Licht vliegtuig', color: '#ffb74d', icon: '&#9992;' };
        if (/^(GLF|CL[36]|LJ[2-7]|C[56]8|FA[27]|E[1-5][0-5]|CRJ|BD70)/.test(type)) return { label: 'Zakenvlucht', color: '#81c784', icon: '&#9992;' };
        if (/^(R22|R44|EC[1-6]|AS[3-5]|B[24]0[5-7]|A109|AW[1-2])/.test(type)) return { label: 'Helikopter', color: '#ce93d8', icon: '&#128681;' };

        return { label: 'Vliegtuig', color: '#aaa', icon: '&#9992;' };
    },

    markerSvg(rotation, color, size) {
        const s = size || 24;
        return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" style="transform:rotate(${rotation}deg);filter:drop-shadow(0 1px 4px rgba(0,0,0,0.7));">
            <path d="M12 2 L14 9 L21 11 L14 13 L14 19 L17 21 L12 20 L7 21 L10 19 L10 13 L3 11 L10 9 Z" fill="${color}" stroke="rgba(0,0,0,0.3)" stroke-width="0.5"/>
        </svg>`;
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

                const iconHtml = this.markerSvg(rotation, color, isTracked ? 30 : 22);

                const altM = alt !== null ? Math.round(alt * 0.3048) : null;
                const speedKmh = speed ? Math.round(speed * 1.852) : null;
                const vRate = ac.baro_rate;
                const vLabel = vRate > 100 ? '&#8599;' : vRate < -100 ? '&#8600;' : '';

                const cls = this.classifyAircraft(ac);
                let tip = `<b>${callsign || hex.toUpperCase()}</b>`;
                if (ac.t) tip += ` <span style="opacity:0.7">${ac.t}</span>`;
                tip += `<br><span style="color:${cls.color}">${cls.label}</span>`;
                if (altM !== null) tip += ` · ${altM.toLocaleString('nl-NL')}m`;
                if (speedKmh) tip += ` · ${speedKmh} km/u ${vLabel}`;

                const iconSize = isTracked ? 30 : 22;
                const half = iconSize / 2;

                const existing = this.markers.get(hex);
                if (existing) {
                    existing.setLatLng([lat, lon]);
                    existing.setIcon(L.divIcon({
                        className: 'flight-marker' + (isTracked ? ' flight-marker-tracked' : ''),
                        html: iconHtml,
                        iconSize: [iconSize, iconSize],
                        iconAnchor: [half, half]
                    }));
                    existing.setTooltipContent(tip);
                    existing._flightData = ac;
                } else {
                    const marker = L.marker([lat, lon], {
                        icon: L.divIcon({
                            className: 'flight-marker' + (isTracked ? ' flight-marker-tracked' : ''),
                            html: iconHtml,
                            iconSize: [iconSize, iconSize],
                            iconAnchor: [half, half]
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

    altBar(alt, maxFt) {
        if (typeof alt !== 'number') return '';
        const pct = Math.min((alt / (maxFt || 45000)) * 100, 100);
        const color = this.altitudeColor(alt);
        return `<div style="height:6px;background:var(--bg);border-radius:3px;overflow:hidden;margin-top:4px;">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width 0.3s;"></div>
        </div>`;
    },

    speedBar(speedKmh) {
        if (!speedKmh) return '';
        const pct = Math.min((speedKmh / 1000) * 100, 100);
        return `<div style="height:6px;background:var(--bg);border-radius:3px;overflow:hidden;margin-top:4px;">
            <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:3px;transition:width 0.3s;"></div>
        </div>`;
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
        const isTracked = ac.hex === this.trackedHex;
        const color = this.altitudeColor(alt);
        const cls = this.classifyAircraft(ac);

        let vRateText = '';
        let vRateColor = 'var(--text)';
        if (typeof vRate === 'number') {
            const vRateMs = Math.round(vRate * 0.00508 * 10) / 10;
            if (vRate > 200) { vRateText = `&#8599; +${vRateMs} m/s`; vRateColor = 'var(--success)'; }
            else if (vRate < -200) { vRateText = `&#8600; ${vRateMs} m/s`; vRateColor = 'var(--warning)'; }
            else vRateText = '&#8594; Vlak';
        }

        let html = `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <div style="flex-shrink:0;">${this.markerSvg(0, color, 48)}</div>
            <div>
                <div style="font-size:18px;font-weight:700;">${callsign || hex}</div>
                <div style="font-size:12px;color:var(--text-dim);">${[type, reg].filter(Boolean).join(' · ')}</div>
                <span style="display:inline-block;margin-top:4px;font-size:11px;font-weight:600;color:${cls.color};background:${cls.color}18;padding:2px 8px;border-radius:10px;">${cls.icon} ${cls.label}</span>
            </div>
        </div>`;

        if (altM !== null) {
            html += `<div style="margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;">
                    <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Hoogte</span>
                    <span style="font-size:11px;color:var(--text-dim);">${altFt.toLocaleString('nl-NL')} ft</span>
                </div>
                <div style="font-size:22px;font-weight:700;color:${color};">${altM.toLocaleString('nl-NL')} m</div>
                ${this.altBar(alt, 45000)}
            </div>`;
        }

        if (speed !== null) {
            html += `<div style="margin-bottom:10px;">
                <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Snelheid</span>
                <div style="font-size:22px;font-weight:700;">${speed} <span style="font-size:14px;font-weight:400;">km/u</span></div>
                ${this.speedBar(speed)}
            </div>`;
        }

        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">';
        if (heading !== undefined) {
            html += `<div>
                <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Koers</span>
                <div style="font-size:16px;font-weight:600;">${Math.round(heading)}° ${headingDir}</div>
            </div>`;
        }
        if (vRateText) {
            html += `<div>
                <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Verticaal</span>
                <div style="font-size:16px;font-weight:600;color:${vRateColor};">${vRateText}</div>
            </div>`;
        }
        html += '</div>';

        if (squawk) {
            const special = { '7500': 'Kaping', '7600': 'Comm. storing', '7700': 'Noodgeval' };
            const isEmergency = special[squawk];
            html += `<div style="margin-bottom:10px;">
                <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;">Squawk</span>
                <div style="font-size:16px;font-weight:600;font-family:monospace;">${squawk}${isEmergency ? ` <span style="color:var(--error);font-family:sans-serif;font-size:13px;font-weight:700;background:rgba(239,83,80,0.15);padding:2px 8px;border-radius:4px;">${isEmergency}</span>` : ''}</div>
            </div>`;
        }

        html += `<div style="font-size:11px;color:var(--text-dim);margin-bottom:10px;font-family:monospace;">ICAO ${hex}</div>`;

        const trackBtnStyle = isTracked
            ? 'background:var(--error);border:1px solid var(--error);color:#fff;'
            : 'background:var(--accent);border:1px solid var(--accent);color:#000;';
        const trackLabel = isTracked ? '&#10006; Stop volgen' : '&#9737; Volgen';

        html += `<div style="display:flex;gap:8px;">
            <button onclick="Flights.toggleTrack('${ac.hex}')"
                style="${trackBtnStyle}padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
                ${trackLabel}</button>
            <a href="https://globe.adsb.fi/?icao=${ac.hex}" target="_blank" rel="noopener"
                style="display:flex;align-items:center;font-size:12px;color:var(--accent);text-decoration:none;">
                ADS-B &rarr;</a>
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
