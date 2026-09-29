const Weather = {
    WMO_CODES: {
        0: 'Helder',
        1: 'Overwegend helder',
        2: 'Deels bewolkt',
        3: 'Bewolkt',
        45: 'Mist',
        48: 'Rijpmist',
        51: 'Lichte motregen',
        53: 'Motregen',
        55: 'Dichte motregen',
        61: 'Lichte regen',
        63: 'Regen',
        65: 'Zware regen',
        71: 'Lichte sneeuw',
        73: 'Sneeuw',
        75: 'Zware sneeuw',
        80: 'Lichte buien',
        81: 'Buien',
        82: 'Zware buien',
        95: 'Onweer',
        96: 'Onweer met hagel',
        99: 'Zwaar onweer met hagel'
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
            condition: this.WMO_CODES[c.weather_code] || 'Onbekend',
            weathercode: c.weather_code,
            is_day: c.is_day
        };
    },

    renderHTML(weather) {
        const windDir = this.windDirectionLabel(weather.winddirection);
        return `
            <h3>Weer</h3>
            <div class="weather-grid">
                <div class="weather-item">
                    <span class="value">${weather.temperature}°C</span>
                    <span class="label">${weather.condition}</span>
                </div>
                <div class="weather-item">
                    <span class="value">${weather.windspeed} km/u</span>
                    <span class="label">Wind ${windDir}</span>
                </div>
                <div class="weather-item">
                    <span class="value">${weather.humidity}%</span>
                    <span class="label">Luchtvochtigheid</span>
                </div>
                <div class="weather-item">
                    <span class="value">${weather.cloudcover}%</span>
                    <span class="label">Bewolking</span>
                </div>
            </div>
        `;
    },

    windDirectionLabel(degrees) {
        const dirs = ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'];
        return dirs[Math.round(degrees / 45) % 8];
    }
};
