# Progress — Brionicle

Laatst bijgewerkt: 2026-10-03 (bugfixes + docs cleanup)

---

## Overzicht

| Fase | Status |
|------|--------|
| 0. Sparren en plannen | ✅ Afgerond |
| 1. Skelet (PWA + kaart + camera + weer) | ✅ Grotendeels afgerond |
| 2. Camera bronnen uitbreiden | 🔶 Deels (RWS API werkt, extra bronnen niet gestart) |
| 3. Info laag (Wikipedia) | ❌ Verwijderd |
| 4. Cloudflare Worker proxy | ✅ Code klaar, wacht op deploy |
| 5. Golden hour / zon | ✅ Afgerond (sunrisesunset.io) |
| 6. Radio | ❌ Verwijderd |
| 7. Aardbevingen | ❌ Verwijderd |
| 8. ISS | ❌ Verwijderd |
| 9. Aurora | ❌ Verwijderd |
| 10. Events / festivals | ❌ Verwijderd |
| 11. Monumenten | ❌ Verwijderd |
| 12. UFO meldingen | ❌ Verwijderd |
| 13. Telescopen | ❌ Verwijderd |
| 14. Roadtrip | ❌ Verwijderd |
| 15. 3D globe | Niet gestart |

## Actieve features (3)

| Feature | Status | Bestanden |
|---------|--------|-----------|
| Verkeerscamera's | ✅ Live op Cloudflare | `js/cameras.js`, 6 API functions |
| Vliegtuigradar | ✅ Live op Cloudflare | `js/flights.js`, 2 API functions |
| Weer bij klik | ✅ Live op Cloudflare | `js/weather.js` |

## Infra status

| Component | Status |
|-----------|--------|
| Cloudflare Pages | ✅ Live (`brionicle.pages.dev`) |
| Cloudflare R2 bucket | ✅ Actief (`brionicle-live`) |
| Oracle VPS screenshot service | ✅ Actief |
| PWA + Service Worker | ✅ Werkend |

## Bugfixes

| Bug | Status |
|------|--------|
| Radio.toggle gebruikte onbestaand `event` object | Gefixt |
| ISS click handler toonde verouderde positie | Gefixt |
| castles.js/mysteries.js: `L.layerGroup()` crashte vóór Leaflet load | Gefixt (2026-10-03) |
| castles.js/mysteries.js: unguarded `load()` crashte `App.init()` | Gefixt (2026-10-03) |
| castles.js: `fetchWiki` zonder null guard | Gefixt (2026-10-03) |
| weather.js: `data.current` zonder null check | Gefixt (2026-10-03) |
| cameras.js: timelapse fetch zonder `res.ok` check | Gefixt (2026-10-03) |
| flights.js: race condition bij concurrent `update()` calls | Gefixt (2026-10-03) |

## Nog te doen

- [ ] Extra camerabronnen toevoegen (Windy, webcam-autoroute)
- [ ] Camera health check mechanisme
- [ ] UI/UX polish (animaties, mobiel)
- [ ] Weer en zontijden reviewen op kwaliteit
- [ ] Camera timelapse en VPS-integratie stabieler maken
- [ ] Manifest.json en PWA iconen checken
- [ ] 3D globe (optioneel, fase 15)
