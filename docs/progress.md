# Progress — Brionicle

Laatst bijgewerkt: 2026-09-28

---

## Fase 0: Sparren en plannen — AFGEROND

Alle onderdelen afgerond: idee, bronnen, architectuur, CORS, lagen, YouTube, pins, roadtrip, hosting, golden hour, aurora, UFO, telescopen, mobiel/PWA, documentatie.

## Fase 1: Skelet — GROTENDEELS AFGEROND

| Stap | Status |
|------|--------|
| PWA basis (index.html, manifest, service worker) | Afgerond |
| Leaflet 2D kaart laden | Afgerond |
| 1 camerabron integreren (RWS API + fallback) | Afgerond |
| Open-Meteo weer bij klik | Afgerond |
| Golden hour / zonsopgang-ondergang | Afgerond |
| Basis pin UI (klik → info paneel) | Afgerond |
| Lagen toggle UI | Afgerond |
| PWA iconen | Afgerond |
| Deploy naar Cloudflare Pages | Wacht op gebruiker |
| Testen op desktop + mobiel | Wacht op deploy |

## Fase 2: Camera bronnen uitbreiden — NIET GESTART

| Stap | Status |
|------|--------|
| Meer RWS camera's (via API) | Werkt via API, fallback 15 camera's |
| Extra bronnen (Windy, webcam-autoroute) | Nog niet gestart |
| Camera health check mechanisme | Nog niet gestart |

## Fase 3: Info laag — AFGEROND

| Stap | Status |
|------|--------|
| Wikipedia API integratie (geosearch + extract + thumbnail) | Afgerond |
| Info bij elke locatieklik | Afgerond |

## Fase 4: Cloudflare Worker proxy — CODE KLAAR

| Stap | Status |
|------|--------|
| Worker script schrijven (worker/proxy.js) | Afgerond |
| Wrangler config (worker/wrangler.toml) | Afgerond |
| Deployen naar Cloudflare | Wacht op gebruiker |

## Fase 5: Golden hour / zon — AFGEROND

| Stap | Status |
|------|--------|
| sunrisesunset.io API integratie | Afgerond |
| Zonsopgang, golden hour, zonsondergang tonen | Afgerond |

## Fase 6: Radio — AFGEROND

| Stap | Status |
|------|--------|
| Radio Browser API integratie | Afgerond |
| Zoeken op nabije stations | Afgerond |
| Audio player met play/stop toggle | Afgerond |

## Fase 7: Aardbevingen — AFGEROND

| Stap | Status |
|------|--------|
| USGS GeoJSON feed (M2.5+ afgelopen dag) | Afgerond |
| Gekleurde cirkelmarkers op de kaart | Afgerond |
| Detail bij klik (magnitude, diepte, tijd, tsunami) | Afgerond |

## Fase 8: ISS — AFGEROND

| Stap | Status |
|------|--------|
| ISS positie API (real-time elke 5 sec) | Afgerond |
| Bewegende marker met trail polyline | Afgerond |
| NASA TV YouTube streams embed | Afgerond |

## Fase 9: Aurora / noorderlicht — AFGEROND

| Stap | Status |
|------|--------|
| NOAA Kp-index forecast | Afgerond |
| Zichtbaarheidskans op basis van latitude | Afgerond |
| Alleen tonen bij locaties >40° | Afgerond |

## Fase 10: Events (festivals, concerten, venues) — AFGEROND

| Stap | Status |
|------|--------|
| festivals.json (15 entries met YouTube kanalen) | Afgerond |
| Pins op de kaart (paars, kleurgecodeerd) | Afgerond |
| YouTube kanaal link bij klik | Afgerond |

## Fase 11: Monumenten (kastelen, musea, natuur) — AFGEROND

| Stap | Status |
|------|--------|
| monuments.json (20 entries wereldwijd) | Afgerond |
| Pins op de kaart (oranje) | Afgerond |
| Wikipedia + weer + zon bij klik | Afgerond |

## Fase 12: UFO meldingen — AFGEROND

| Stap | Status |
|------|--------|
| ufo-sightings.json (25 meldingen, 5x NL) | Afgerond |
| js/ufo.js module | Afgerond |
| UFO als toggle laag op de kaart | Afgerond |
| Detail bij klik (vorm, duur, beschrijving, bron) | Afgerond |

## Fase 13: Telescopen — AFGEROND

| Stap | Status |
|------|--------|
| telescopes.json (8 observatoria) | Afgerond |
| Pins op de kaart (blauw) | Afgerond |
| Website + webcam links bij klik | Afgerond |

## Fase 14: Roadtrip — AFGEROND

| Stap | Status |
|------|--------|
| OSRM route berekening (gratis, geen API key) | Afgerond |
| Route tekenen op de kaart | Afgerond |
| Afstand + rijtijd berekening | Afgerond |
| Camera's en pins langs route markeren (15km buffer) | Afgerond |
| UI: klik start/eind op kaart, wissen | Afgerond |

## Fase 15: 3D globe (optioneel) — NIET GESTART

| Stap | Status |
|------|--------|
| Three.js globe implementatie | Nog niet gestart |
| Toggle 2D/3D | Nog niet gestart |

## Bugfixes

| Bug | Status |
|------|--------|
| Radio.toggle gebruikte onbestaand `event` object | Gefixt |
| ISS click handler toonde verouderde positie | Gefixt |

## Nog te doen (met gebruiker)

- [ ] Deploy naar Cloudflare Pages
- [ ] Cloudflare Worker proxy deployen
- [ ] Testen op Samsung Galaxy S22 Ultra
- [ ] Extra camerabronnen toevoegen
- [ ] 3D globe (optioneel, fase 15)
