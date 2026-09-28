const Aurora = {
    async getKpIndex() {
        try {
            const res = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json');
            if (!res.ok) return null;
            const data = await res.json();
            if (data.length < 2) return null;
            const latest = data[data.length - 1];
            return {
                kp: parseFloat(latest[1]),
                time: latest[0],
                observed: latest[2] === 'observed'
            };
        } catch {
            return null;
        }
    },

    getVisibilityChance(lat, kp) {
        const absLat = Math.abs(lat);
        if (kp >= 8 && absLat >= 40) return 'Hoog';
        if (kp >= 6 && absLat >= 50) return 'Hoog';
        if (kp >= 5 && absLat >= 55) return 'Goed';
        if (kp >= 4 && absLat >= 60) return 'Goed';
        if (kp >= 3 && absLat >= 65) return 'Matig';
        if (absLat >= 65) return 'Laag';
        if (absLat < 45) return 'Zeer onwaarschijnlijk';
        return 'Onwaarschijnlijk';
    },

    getKpColor(kp) {
        if (kp >= 7) return 'var(--error)';
        if (kp >= 5) return 'var(--warning)';
        if (kp >= 3) return 'var(--success)';
        return 'var(--text-dim)';
    },

    async renderHTML(lat) {
        const kpData = await this.getKpIndex();
        if (!kpData) return '';

        const chance = this.getVisibilityChance(lat, kpData.kp);
        const color = this.getKpColor(kpData.kp);
        const absLat = Math.abs(lat);

        if (absLat < 40 && kpData.kp < 7) return '';

        return `
            <h3>Noorderlicht</h3>
            <div class="weather-grid">
                <div class="weather-item">
                    <span class="value" style="color:${color};">Kp ${kpData.kp.toFixed(0)}</span>
                    <span class="label">Geomagnetische index</span>
                </div>
                <div class="weather-item">
                    <span class="value">${chance}</span>
                    <span class="label">Zichtbaarheid hier</span>
                </div>
            </div>
            <p style="font-size:12px;color:var(--text-dim);margin-top:8px;">
                ${kpData.kp >= 5 ? 'Verhoogde activiteit — kans op aurora!' : 'Normale activiteit'}
            </p>
        `;
    }
};
