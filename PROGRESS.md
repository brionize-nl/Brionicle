# Brionicle — Handoff Blueprint

**Laatste update:** 2026-09-30
**Status:** 3 core features, productie op Cloudflare Pages

## Project

Brionicle is een persoonlijke interactieve wereldkaart PWA.
- **Eigenaar:** Brionize (brionize.nl@gmail.com)
- **Hosting:** Cloudflare Pages — `brionicle.pages.dev`
- **Repo:** `brionize-nl/Brionicle` (branch: `main`)
- **Taal:** Alles in het Nederlands
- **Regels:** Geen betaalde diensten, geen API keys, geen demos/prototypes

## Architectuur

```
Browser (Leaflet + hls.js)
    ↓
Cloudflare Pages Functions (serverless proxy)
    ↓
Externe gratis API's (RWS, ADS-B, Open-Meteo, adsbdb)
    ↓
Cloudflare R2 bucket (brionicle-live) — voor camera live/timelapse
    ↓
Oracle VPS (84.235.182.106) — desktop screenshot service voor cameras
```

## Features (3 actief)

### 1. Verkeerscamera's
- **Bron:** RWS API (`api.rwsverkeersinfo.nl/api/cameras`)
- **Frontend:** `js/cameras.js` (~486 regels)
- **API's:** `camera-image.js`, `camera-stream.js`, `camera-live.js`, `camera-control.js`, `timelapse.js`, `cameras.js`
- **Functies:** Live HLS stream, snapshot, timelapse met slider/play/speed
- **VPS:** Oracle ARM64 maakt desktop screenshots, slaat op in R2
- **R2 paden:** `live/{id}.jpg`, `timelapse/{id}/`, `streams/{id}.json`, `control.json`

### 2. Vliegtuigradar
- **Bron:** ADS-B.lol (`api.adsb.lol/v2/`) + adsbdb.com (routes)
- **Frontend:** `js/flights.js` (~400 regels)
- **API's:** `flights.js` (ADS-B proxy), `flight-route.js` (route lookup)
- **Functies:**
  - SVG vliegtuigmarkers met kleur per hoogte
  - Classificatie: Militair/Lijnvlucht/Zakenvlucht/Helikopter/Licht/Drone/Zweefvliegtuig/Ballon
  - Infopanel: hoogte, snelheid, koers, verticale snelheid, squawk (incl. noodcodes)
  - Route van A naar B (herkomst/bestemming met IATA-codes)
  - Volgen-functie met auto-pan en panel auto-refresh (10s)
  - Vliegtuigteller rechtsonder
  - Prefetch Brummen-Amersfoort regio voor snelle eerste lading
  - Foutmelding toast bij API problemen
- **Proxy:** Valideert lat/lon/dist, klempt dist op 1-250 NM

### 3. Weer bij klik
- **Bron:** Open-Meteo (weer) + sunrisesunset.io (zontijden)
- **Frontend:** `js/weather.js` (~73 regels)
- **Functies:** WMO-weercode met emoji, temperatuur, zonsopgang/ondergang/golden hour
- **Geen proxy nodig** — beide API's hebben CORS headers

## Bestandsstructuur

```
js/
  app.js          — Hoofd-app: kaart, panel, lagen, locatie
  cameras.js      — Camera module
  flights.js      — Vliegtuig module
  weather.js      — Weer module

functions/api/
  cameras.js      — RWS camera lijst ophalen
  camera-image.js — Snapshot proxy (met 5min cache)
  camera-stream.js — HLS manifest proxy + rewriting
  camera-live.js  — R2 live beeld ophalen
  camera-control.js — VPS control.json lezen/schrijven
  timelapse.js    — R2 timelapse frames
  flights.js      — ADS-B proxy met validatie
  flight-route.js — adsbdb.com route proxy

css/style.css     — Donker thema, responsive
index.html        — Single page app
sw.js             — Service worker (cache: brionicle-v3)
manifest.json     — PWA manifest
```

## Infra

| Dienst | Doel | Kosten |
|--------|------|--------|
| Cloudflare Pages | Frontend + Functions | Gratis |
| Cloudflare R2 | Camera opslag (bucket: `brionicle-live`) | Gratis tier |
| Oracle Cloud VPS | Desktop screenshots | Gratis tier (ARM64) |
| ADS-B.lol | Vliegtuigdata | Gratis, geen key |
| Open-Meteo | Weerdata | Gratis, geen key |
| adsbdb.com | Vliegroutes | Gratis, geen key |
| RWS API | Camera's | Gratis, geen key |
| sunrisesunset.io | Zontijden | Gratis, geen key |

**Account ID Cloudflare:** `71fc493155b071bebcc185ea1c208966`
**VPS IP:** `84.235.182.106` (hostname: `n8n-vm`, Ubuntu 24.04.5)
**VPS Brionicle pad:** `~/Brionicle` (hoofdletter B)

## Beveiliging

- R2 API keys en Cloudflare tokens NOOIT in code — alleen via Cloudflare dashboard
- `desktop/config.json` staat in `.gitignore`
- R2 bucket toegang via Pages Function binding (`context.env.LIVE_BUCKET`)
- Proxy functies valideren alle input parameters
- ALLOWED_HOSTS whitelist in camera-stream.js

## Verwijderd (niet meer actief)

Deze features zijn bewust verwijderd omdat ze niet werkten of niet nodig waren:
- ISS tracker, UFO meldingen, Pins, Roadtrip, Windy, Wikipedia, Radio, Aurora
- Aardbevingen (USGS), Regenradar (RainViewer)
- Alle bijbehorende data-bestanden (festivals.json, monuments.json, etc.)

## Commit historie (deze sessie)

1. `81efb48` — Verkeerscamera's verbeteren: 5 fixes
2. `86c9d3b` — Vliegtuigradar verbeteren: 6 fixes
3. `217c61c` — Snellere vliegtuigradar: prefetch Brummen-Amersfoort
4. `5135da8` — Route-info (van A naar B) in vliegtuigpanel
5. `d5a0a16` — Aardbevingen en regenradar verwijderd

## Volgende sessie

- Weer en zontijden zijn niet gereviewd op kwaliteit
- Camera timelapse en VPS-integratie kunnen stabieler
- UI/UX polish mogelijk (animaties, mobiel)
- Manifest.json en PWA iconen checken
