const Cameras = {
    markers: [],
    layerGroup: null,

    init(map) {
        this.layerGroup = L.layerGroup().addTo(map);
    },

    async loadRWS() {
        try {
            const res = await fetch('https://api.rwsverkeersinfo.nl/api/cameras');
            if (!res.ok) throw new Error(`RWS API status ${res.status}`);
            const cameras = await res.json();
            return cameras.map(cam => ({
                id: String(cam.id),
                name: cam.location_description || cam.locationDescription || 'Camera',
                road: cam.road || cam.roadDesignation || '',
                lat: parseFloat(cam.latitude),
                lon: parseFloat(cam.longitude),
                streamUrl: cam.stream_url || cam.streamUrl || null,
                staticUrl: cam.static_url || cam.staticUrl || null,
                type: 'embed',
                source: 'Rijkswaterstaat'
            })).filter(c => !isNaN(c.lat) && !isNaN(c.lon));
        } catch (e) {
            console.warn('RWS API niet bereikbaar, fallback wordt geladen:', e.message);
            return this.getFallbackCameras();
        }
    },

    getFallbackCameras() {
        return [
            { id: 'rws-4', name: 'A1 Amersfoort', road: 'A1', lat: 52.1561, lon: 5.3878, streamUrl: 'https://stream.inmoves.nl/4/embed', staticUrl: 'https://stream.inmoves.nl/4', type: 'embed', source: 'Rijkswaterstaat' },
            { id: 'rws-1', name: 'A2 Breukelen', road: 'A2', lat: 52.1728, lon: 4.9927, streamUrl: 'https://stream.inmoves.nl/1/embed', staticUrl: 'https://stream.inmoves.nl/1', type: 'embed', source: 'Rijkswaterstaat' },
            { id: 'rws-6', name: 'A4 Leidschendam', road: 'A4', lat: 52.0833, lon: 4.3833, streamUrl: 'https://stream.inmoves.nl/6/embed', staticUrl: 'https://stream.inmoves.nl/6', type: 'embed', source: 'Rijkswaterstaat' },
            { id: 'rws-10', name: 'A10 Amsterdam-West', road: 'A10', lat: 52.3676, lon: 4.8344, streamUrl: 'https://stream.inmoves.nl/10/embed', staticUrl: 'https://stream.inmoves.nl/10', type: 'embed', source: 'Rijkswaterstaat' },
            { id: 'rws-12', name: 'A12 Den Haag', road: 'A12', lat: 52.0705, lon: 4.3007, streamUrl: 'https://stream.inmoves.nl/12/embed', staticUrl: 'https://stream.inmoves.nl/12', type: 'embed', source: 'Rijkswaterstaat' },
            { id: 'rws-13', name: 'A13 Delft', road: 'A13', lat: 51.9975, lon: 4.3575, streamUrl: 'https://stream.inmoves.nl/24/embed', staticUrl: 'https://stream.inmoves.nl/24', type: 'embed', source: 'Rijkswaterstaat' },
            { id: 'rws-15', name: 'A15 Europoort', road: 'A15', lat: 51.8867, lon: 4.3250, streamUrl: 'https://stream.inmoves.nl/15/embed', staticUrl: 'https://stream.inmoves.nl/15', type: 'embed', source: 'Rijkswaterstaat' },
            { id: 'rws-16', name: 'A16 Dordrecht', road: 'A16', lat: 51.8133, lon: 4.6692, streamUrl: 'https://stream.inmoves.nl/27/embed', staticUrl: 'https://stream.inmoves.nl/27', type: 'embed', source: 'Rijkswaterstaat' },
            { id: 'rws-20', name: 'A20 Rotterdam', road: 'A20', lat: 51.9400, lon: 4.4300, streamUrl: 'https://stream.inmoves.nl/20/embed', staticUrl: 'https://stream.inmoves.nl/20', type: 'embed', source: 'Rijkswaterstaat' },
            { id: 'rws-27', name: 'A27 Gorinchem', road: 'A27', lat: 51.8333, lon: 4.9667, streamUrl: 'https://stream.inmoves.nl/53/embed', staticUrl: 'https://stream.inmoves.nl/53', type: 'embed', source: 'Rijkswaterstaat' },
            { id: 'rws-28', name: 'A28 Amersfoort-Zuid', road: 'A28', lat: 52.1400, lon: 5.3700, streamUrl: 'https://stream.inmoves.nl/28/embed', staticUrl: 'https://stream.inmoves.nl/28', type: 'embed', source: 'Rijkswaterstaat' },
            { id: 'rws-50', name: 'A50 Eindhoven', road: 'A50', lat: 51.4416, lon: 5.4697, streamUrl: 'https://stream.inmoves.nl/50/embed', staticUrl: 'https://stream.inmoves.nl/50', type: 'embed', source: 'Rijkswaterstaat' },
            { id: 'rws-58', name: 'A58 Tilburg', road: 'A58', lat: 51.5519, lon: 5.0913, streamUrl: 'https://stream.inmoves.nl/58/embed', staticUrl: 'https://stream.inmoves.nl/58', type: 'embed', source: 'Rijkswaterstaat' },
            { id: 'rws-7', name: 'A7 Groningen', road: 'A7', lat: 53.2194, lon: 6.5665, streamUrl: 'https://stream.inmoves.nl/7/embed', staticUrl: 'https://stream.inmoves.nl/7', type: 'embed', source: 'Rijkswaterstaat' },
            { id: 'rws-9', name: 'A9 Haarlem', road: 'A9', lat: 52.3833, lon: 4.6333, streamUrl: 'https://stream.inmoves.nl/9/embed', staticUrl: 'https://stream.inmoves.nl/9', type: 'embed', source: 'Rijkswaterstaat' }
        ];
    },

    show(cameras, map, onCameraClick) {
        this.layerGroup.clearLayers();
        this.markers = [];

        cameras.forEach(cam => {
            const marker = L.marker([cam.lat, cam.lon], {
                icon: L.divIcon({
                    className: 'camera-marker',
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                })
            });

            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                onCameraClick(cam);
            });

            marker.bindTooltip(cam.name, {
                direction: 'top',
                offset: [0, -8],
                className: 'camera-tooltip'
            });

            this.layerGroup.addLayer(marker);
            this.markers.push({ marker, camera: cam });
        });
    },

    hide() {
        this.layerGroup.clearLayers();
        this.markers = [];
    },

    renderCamera(cam) {
        if (cam.streamUrl) {
            return `
                <iframe src="${cam.streamUrl}"
                        width="100%"
                        height="220"
                        frameborder="0"
                        allowfullscreen
                        loading="lazy"
                        style="border-radius: 6px; background: #000;">
                </iframe>
                <button class="camera-refresh" onclick="App.refreshCamera()" title="Ververs beeld">&#8635;</button>
            `;
        }

        if (cam.imageUrl) {
            const cacheBust = Date.now();
            return `
                <img src="${cam.imageUrl}?t=${cacheBust}"
                     alt="${cam.name}"
                     onerror="this.parentElement.innerHTML='<div class=\\'error\\'>Beeld kon niet worden geladen</div>'"
                     loading="lazy">
                <button class="camera-refresh" onclick="App.refreshCamera()" title="Ververs beeld">&#8635;</button>
            `;
        }

        return '<div class="loading">Geen beeld beschikbaar voor deze camera</div>';
    }
};
