const Weather = {
    WMO_CODES: {
        0: ['Helder', '&#9728;&#65039;'],
        1: ['Overwegend helder', '&#127780;&#65039;'],
        2: ['Deels bewolkt', '&#9925;'],
        3: ['Bewolkt', '&#9729;&#65039;'],
        45: ['Mist', '&#127787;&#65039;'],
        48: ['Rijpmist', '&#127787;&#65039;'],
        51: ['Lichte motregen', '&#127782;&#65039;'],
        53: ['Motregen', '&#127782;&#65039;'],
        55: ['Dichte motregen', '&#127782;&#65039;'],
        61: ['Lichte regen', '&#127783;&#65039;'],
        63: ['Regen', '&#127783;&#65039;'],
        65: ['Zware regen', '&#127783;&#65039;'],
        71: ['Lichte sneeuw', '&#127784;&#65039;'],
        73: ['Sneeuw', '&#127784;&#65039;'],
        75: ['Zware sneeuw', '&#127784;&#65039;'],
        80: ['Lichte buien', '&#127783;&#65039;'],
        81: ['Buien', '&#127783;&#65039;'],
        82: ['Zware buien', '&#127783;&#65039;'],
        95: ['Onweer', '&#9889;'],
        96: ['Onweer met hagel', '&#9889;'],
        99: ['Zwaar onweer met hagel', '&#9889;']
    },

    async fetch(lat, lon) {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,is_day&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Weer ophalen mislukt');
        const data = await res.json();
        const c = data.current;
        return {
            temperature: Math.round(c.temperature_2m),
            windspeed: Math.round(c.wind_speed_10m),
            winddirection: c.wind_direction_10m,
            humidity: c.relative_humidity_2m,
            cloudcover: c.cloud_cover,
            condition: (this.WMO_CODES[c.weather_code] || ['Onbekend', ''])[0],
            conditionIcon: (this.WMO_CODES[c.weather_code] || ['', '&#9729;&#65039;'])[1],
            weathercode: c.weather_code,
            is_day: c.is_day
        };
    },

    renderHTML(weather) {
        const windDir = this.windDirectionLabel(weather.winddirection);
        return `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                <span style="font-size:36px;line-height:1;">${weather.conditionIcon}</span>
                <div>
                    <div style="font-size:26px;font-weight:700;">${weather.temperature}°C</div>
                    <div style="font-size:12px;color:var(--text-dim);">${weather.condition}</div>
                </div>
            </div>
            <div class="weather-grid">
                <div class="weather-item">
                    <span class="value">${weather.windspeed} km/u</span>
                    <span class="label">Wind ${windDir}</span>
                </div>
                <div class="weather-item">
                    <span class="value">${weather.humidity}%</span>
                    <span class="label">Luchtvochtigheid</span>
                </div>
            </div>
        `;
    },

    windDirectionLabel(degrees) {
        const dirs = ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'];
        return dirs[Math.round(degrees / 45) % 8];
    }
};
