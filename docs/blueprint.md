# Blueprint — Brionicle

Technische blauwdruk. Alle bronnen zijn gevalideerd en besproken in de sparfase.

---

## Architectuur

```
Gebruiker (browser/PWA)
    |
    ├── Leaflet 2D kaart (standaard)
    ├── Three.js 3D globe (optioneel toggle)
    |
    ├── Eigen JSON data (in repo)
    |   ├── festivals.json
    |   ├── monuments.json (kastelen, musea, natuur)
    |   ├── telescopes.json
    |   ├── youtube-channels.json
    |   └── ufo-sightings.json (NUFORC dataset)
    |
    ├── Publieke APIs (geen keys, on-demand)
    |   ├── Open-Meteo (weer)
    |   ├── USGS (aardbevingen)
    |   ├── Radio Browser (radiostations)
    |   ├── Wikipedia / Wikimedia (info + foto's)
    |   ├── sunrisesunset.io of SunCalc (golden hour)
    |   ├── NOAA (aurora forecast)
    |   ├── open-notify.org (ISS positie)
    |   ├── OSRM (route berekening)
    |   └── YouTube RSS feeds (video check)
    |
    ├── Camera bronnen (JPEG snapshots, on-demand)
    |   ├── TrafficVision.Live (155.000+ wereldwijd)
    |   ├── Rijkswaterstaat API (NL snelwegen)
    |   ├── OpenWebcamDB (1.925 streams, 59 landen)
    |   ├── webcam-autoroute.eu (FR/BE/NL/DE/CH/LU/ES)
    |   └── Windy Webcams (free tier, lage res)
    |
    ├── HLS streams (in-browser via HLS.js)
    |   ├── NASA ISS streams
    |   └── Sommige webcams
    |
    └── Cloudflare Worker (image proxy, alleen bij CORS)
```

**Hosting**: Cloudflare Pages (frontend) + Cloudflare Worker (proxy)
**Code**: GitHub repository
**Health checks**: GitHub Actions (periodiek, camera-bronnen testen)

---

## Databronnen — gedetailleerd

### Camera's

| Bron | Type | URL/API | Key? | CORS? | Opmerkingen |
|------|------|---------|------|-------|-------------|
| TrafficVision.Live | JPEG snapshot | trafficvision.live | Nee | Via <img> tag | 155.000+ cameras, 130+ landen |
| Rijkswaterstaat | JPEG snapshot | api.rwsverkeersinfo.nl/api/cameras | Nee | Via <img> tag | NL snelwegen, HD |
| OpenWebcamDB | Mix (JPEG/HLS) | openwebcamdb.org API | Nee (25 req/dag) | Via <img> tag | 1.925 streams, 59 landen |
| webcam-autoroute.eu | JPEG snapshot | Geen API, scrapen of handmatig | Nee | Via <img> tag | FR/BE/NL/DE/CH/LU/ES snelwegen |
| Windy Webcams | JPEG (lage res) | api.windy.com/webcams | Nee (free tier) | Via <img> tag | Token verloopt na 10 min |

**CORS oplossing**: JPEG snapshots via `<img>` tag → geen CORS probleem. Alleen als we pixel-data nodig hebben (canvas) → Cloudflare Worker proxy.

**RTSP**: wordt niet ondersteund. Niet nodig — vrijwel alle publieke bronnen zijn JPEG of HLS.

### Weer

| Eigenschap | Waarde |
|------------|--------|
| Bron | Open-Meteo |
| URL | api.open-meteo.com/v1/forecast |
| Parameters | latitude, longitude, current_weather=true |
| Key | Nee |
| Limiet | 10.000 calls/dag |
| Geeft | Temperatuur, windsnelheid, windrichting, weercode |

### Golden hour / zon

| Eigenschap | Waarde |
|------------|--------|
| Optie 1 | SunCalc JavaScript library (in-browser, geen API call) |
| Optie 2 | sunrisesunset.io/api (geen key, geen limiet) |
| Geeft | Zonsopgang, zonsondergang, golden hour begin/eind, blue hour, twilight, maanfase |
| Voorkeur | SunCalc (nul requests, werkt offline) |

### Aardbevingen

| Eigenschap | Waarde |
|------------|--------|
| Bron | USGS |
| URL | earthquake.usgs.gov/earthquakes/feed/v1.0/summary/ |
| Feeds | all_hour.geojson, all_day.geojson, all_week.geojson |
| Key | Nee |
| Limiet | Geen |
| Geeft | Magnitude, locatie (lat/lon), diepte, tijd, tsunami-waarschuwing |
| Update | Elke 5 minuten server-side |

### Radio

| Eigenschap | Waarde |
|------------|--------|
| Bron | Radio Browser API |
| URL | de1.api.radio-browser.info (meerdere mirrors) |
| GPS filter | /stations/bycoordinate/{lat}/{lon}/{radius} |
| Key | Nee |
| Limiet | Geen |
| Geeft | Naam, land, taal, codec, bitrate, genre |
| Afspelen | Via <audio> tag in de browser |

### ISS

| Eigenschap | Waarde |
|------------|--------|
| Positie | api.open-notify.org/iss-now.json (real-time lat/lon) |
| Video | NASA HLS: nasa-i.akamaihd.net/hls/live/253565/NASA-NTV1-Public/master.m3u8 |
| Kanalen | NTV1, NTV2, NTV3 |
| Afspelen | HLS.js in de browser |
| Let op | Streams gaan offline bij Loss of Signal — dat is normaal |

### Aurora / Noorderlicht

| Eigenschap | Waarde |
|------------|--------|
| Bron | NOAA Space Weather Prediction Center |
| URL | swpc.noaa.gov/products/aurora-30-minute-forecast |
| Data | Aurora kans-kaart (JSON/afbeelding), Kp-index |
| Key | Nee |
| Limiet | Geen |
| Tonen bij | Noordelijke locaties (>55° latitude) |

### Locatie info

| Eigenschap | Waarde |
|------------|--------|
| Info | Wikipedia API (gratis, geen key) |
| Foto's | Wikimedia Commons (gratis, geen key) |
| Tonen | Altijd als fallback — de "offline" laag die altijd werkt |

### YouTube / Events

| Eigenschap | Waarde |
|------------|--------|
| Embed | youtube.com/embed/VIDEO_ID (gratis, onbeperkt) |
| Video ID vinden | YouTube RSS feed: youtube.com/feeds/videos.xml?channel_id=ID |
| Live check | Kanaal /live URL check (gratis, geen API) |
| API | YouTube Data API v3 alleen als backup (100 searches/dag bij 10.000 quota) |
| Opzet | Gecureerde lijst van kanaal-IDs in youtube-channels.json |

**Patroon**: Entry in JSON is permanent. Voor event: info. Tijdens: livestream als beschikbaar. Na: officiële video's/aftermovie.

### UFO meldingen

| Eigenschap | Waarde |
|------------|--------|
| Bron | NUFORC dataset (via GitHub/Kaggle) |
| Data | 100.000+ meldingen met lat/lon coördinaten |
| Formaat | CSV/JSON, eenmalige download, opslaan in repo |
| Key | Nee |
| Tonen | "X UFO meldingen binnen Y km van deze plek" |

### Telescopen

| Eigenschap | Waarde |
|------------|--------|
| ESO Paranal | eso.org/public/outreach/webcams/ — 24/7 webcam |
| VLA New Mexico | public.nrao.edu/vla-webcam/ — JPEG elke 15 sec |
| Virtual Telescope | virtualtelescope.eu/webtv/ — YouTube livestreams |
| McDonald Observatory | YouTube livestreams |
| Royal Observatory | YouTube livestreams |
| Space Telescope Live | spacetelescopelive.org — Hubble/Webb real-time target |

### Route berekening (roadtrip)

| Eigenschap | Waarde |
|------------|--------|
| Bron | OSRM (Open Source Routing Machine) |
| Gebaseerd op | OpenStreetMap data |
| Key | Nee |
| Hoe | Bereken route → krijg lijn van coördinaten → zoek camera's/pins binnen X km van de lijn |

---

## Universeel pin-patroon

Alles in Brionicle is een pin op de kaart. Het type verschilt, het patroon is altijd hetzelfde:

```
Pin aanklikken
    ├── Info tonen (altijd beschikbaar)
    |   ├── Naam, type, locatie
    |   ├── Wikipedia info + foto's
    |   └── Weer (Open-Meteo)
    |
    ├── Contextafhankelijke data
    |   ├── Golden hour / zon tijden
    |   ├── Nabije radiostations
    |   ├── Nabije camera's
    |   ├── Aardbevingen (als seismisch actief)
    |   └── Aurora kans (als noordelijk)
    |
    └── Media (on-demand)
        ├── Camera beeld (JPEG/HLS)
        ├── YouTube stream/video
        └── Audio (radio)
```

---

## PWA en mobiel

| Platform | Standaard | Optie |
|----------|-----------|-------|
| Desktop | Three.js 3D globe | Toggle naar 2D |
| Mobiel (krachtig, bijv. S22 Ultra 12GB) | Leaflet 2D | Toggle naar 3D |
| Mobiel (oud/zwak) | Leaflet 2D | Geen 3D optie |

Detectie: check GPU/geheugen capabilities → toon/verberg 3D toggle.

---

## Roadtrip camera-dichtheid

Route Amsterdam → Parijs (~500km, A4 → A16 → E19 → A1):

| Land | Bron | Camera's |
|------|------|----------|
| Nederland | TrafficVision.Live | 250+ landelijk, 800+ Zuid-Holland |
| Nederland | Rijkswaterstaat | HD snelwegcamera's |
| België | TrafficVision.Live | 500+ Brussel, 1.500+ Luik |
| België | opencctv.org | 420 totaal |
| Frankrijk | SANEF | Knooppunten en tolstations |

Conclusie: meer dan genoeg dekking op West-Europese snelwegen.

---

## Cloudflare Worker proxy

Alleen nodig wanneer een camera-bron CORS blokkeert en we pixel-data nodig hebben (canvas manipulatie). Voor gewone `<img>` tags is geen proxy nodig.

Gratis tier: 100.000 requests/dag. Met on-demand architectuur (alleen bij klik) ruim voldoende voor persoonlijk gebruik.

---

## GitHub Actions health checks

Periodiek (bijv. dagelijks) een script draaien dat:
1. Elke camera-bron URL pingt
2. Elke API endpoint checkt
3. Bij falen: GitHub notification / email

Gratis: 2.000 minuten/maand.
