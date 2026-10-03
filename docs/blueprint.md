# Blueprint — Brionicle

Technische blauwdruk. Bijgewerkt: 2026-10-03.

---

## Architectuur

```
Browser (Leaflet + HLS.js)
    ↓
Cloudflare Pages Functions (serverless proxy)
    ↓
Externe gratis API's (RWS, ADS-B, Open-Meteo, adsbdb, sunrisesunset.io)
    ↓
Cloudflare R2 bucket (brionicle-live) — camera live/timelapse opslag
    ↓
Oracle VPS (84.235.182.106) — desktop screenshot service voor cameras
```

**Hosting**: Cloudflare Pages (frontend + serverless functions)
**Opslag**: Cloudflare R2 (camera screenshots, timelapse)
**VPS**: Oracle ARM64 gratis tier (screenshot service)
**Code**: GitHub `brionize-nl/Brionicle`

---

## Actieve features (3)

### 1. Verkeerscamera's
| Eigenschap | Waarde |
|------------|--------|
| Bron | RWS API (`api.rwsverkeersinfo.nl/api/cameras`) |
| Frontend | `js/cameras.js` (~486 regels) |
| Functies | Live HLS stream, snapshot, timelapse met slider/play/speed |
| VPS | Oracle ARM64 maakt desktop screenshots, slaat op in R2 |
| R2 paden | `live/{id}.jpg`, `timelapse/{id}/`, `streams/{id}.json`, `control.json` |
| Proxy | `camera-image.js` (snapshot), `camera-stream.js` (HLS), `camera-live.js` (R2) |

### 2. Vliegtuigradar
| Eigenschap | Waarde |
|------------|--------|
| Bron | ADS-B.lol (`api.adsb.lol/v2/`) + adsbdb.com (routes) |
| Frontend | `js/flights.js` (~400 regels) |
| Functies | SVG markers per hoogte, classificatie (militair/lijnvlucht/heli/drone), route A→B, volgen met auto-pan |
| Proxy | `flights.js` (ADS-B), `flight-route.js` (routes) |
| Prefetch | Brummen-Amersfoort regio voor snelle eerste lading |

### 3. Weer bij klik
| Eigenschap | Waarde |
|------------|--------|
| Bron | Open-Meteo (weer) + sunrisesunset.io (zontijden) |
| Frontend | `js/weather.js` (~73 regels) |
| Functies | WMO-weercode met emoji, temperatuur, zonsopgang/ondergang/golden hour |
| Proxy | Geen nodig — beide API's hebben CORS headers |

---

## Databronnen

| Bron | Type | Key? | Gebruikt door |
|------|------|------|---------------|
| RWS API | Camera JPEG/HLS | Nee | Verkeerscamera's |
| ADS-B.lol | Vliegtuigdata JSON | Nee | Vliegtuigradar |
| adsbdb.com | Vliegroutes JSON | Nee | Vliegtuigradar |
| Open-Meteo | Weer JSON | Nee | Weer bij klik |
| sunrisesunset.io | Zontijden JSON | Nee | Weer bij klik |

---

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

---

## Infra

| Dienst | Doel | Kosten |
|--------|------|--------|
| Cloudflare Pages | Frontend + Functions | Gratis |
| Cloudflare R2 | Camera opslag (`brionicle-live`) | Gratis tier |
| Oracle Cloud VPS | Desktop screenshots | Gratis tier (ARM64) |
| ADS-B.lol | Vliegtuigdata | Gratis, geen key |
| Open-Meteo | Weerdata | Gratis, geen key |
| adsbdb.com | Vliegroutes | Gratis, geen key |
| RWS API | Camera's | Gratis, geen key |
| sunrisesunset.io | Zontijden | Gratis, geen key |

**Cloudflare Account ID:** `71fc493155b071bebcc185ea1c208966`
**VPS IP:** `84.235.182.106` (hostname: `n8n-vm`, Ubuntu 24.04.5)
**VPS Brionicle pad:** `~/Brionicle`

---

## Beveiliging

- R2 API keys en Cloudflare tokens NOOIT in code — alleen via Cloudflare dashboard
- `desktop/config.json` staat in `.gitignore`
- R2 bucket toegang via Pages Function binding (`context.env.LIVE_BUCKET`)
- Proxy functies valideren alle input parameters
- ALLOWED_HOSTS whitelist in camera-stream.js

---

## Verwijderde features

Deze features zijn bewust verwijderd (waren gebouwd maar niet nodig/werkend):
- ISS tracker, UFO meldingen, Pins, Roadtrip, Windy, Wikipedia, Radio, Aurora
- Aardbevingen (USGS), Regenradar (RainViewer)
- Alle bijbehorende data-bestanden (festivals.json, monuments.json, etc.)

---

## DELPHI (apart project)

Ollama PWA is verhuisd naar eigen repo: `brionize-nl/DELPHI`
Draait op `ollama.brionize.nl` — zie die repo voor documentatie.
