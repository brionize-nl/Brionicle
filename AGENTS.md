# AGENTS.md — Brionicle

## Project
Brionicle — Interactieve wereldkaart met live camera's, weer, radio, events en meer.
Eigenaar: Brionize (enige gebruiker). Geen publiek, geen scaling, geen multi-user.

## Regels (niet-onderhandelbaar)

1. **Geen demo's, geen prototypes** — alleen werkend eindproduct
2. **Niet gokken** — alles is gevalideerd in de sparfase (zie blueprint.md)
3. **Backend/data eerst, frontend later** — de 3D globe is minder belangrijk
4. **On-demand architectuur** — niets laden totdat de gebruiker erom vraagt
5. **100% gratis** — geen betaalde diensten, geen API keys, geen VPS
6. **Elke laag is onafhankelijk** — als een bron doodgaat, draait de rest door
7. **Geen overbodige abstracties** — simpele, rechte code
8. **Lees blueprint.md EERST** — alles is al uitgedacht, niet opnieuw uitvinden

## Architectuur (kort)

- **Frontend hosting**: Cloudflare Pages (PWA)
- **Image proxy**: Cloudflare Worker (~50 regels, alleen voor CORS)
- **Data**: eigen JSON bestanden in de repo (festivals, kastelen, YouTube kanalen, UFO, telescopen)
- **Kaart**: Leaflet 2D (standaard), Three.js 3D (optioneel, toggle)
- **Video**: HLS.js voor HLS streams, YouTube embed voor de rest
- **Geen database, geen backend server, geen auth, geen API keys**

## On-demand principe

Dit is het kernprincipe van het hele project:

1. Gebruiker klikt op een locatie of typt een zoekopdracht
2. **Eerst**: info tonen (naam, locatie, Wikipedia, weer) — dat werkt altijd
3. **Dan bij klik**: camera-beeld of video ophalen — on-demand
4. Nooit continu pollen, nooit op voorhand laden, nooit data opslaan die je niet hebt gevraagd

## Bouwvolgorde

Eén laag tegelijk. Volledig werkend voordat de volgende begint.

1. Skelet: PWA + Leaflet kaart + 1 camerabron (TrafficVision JPEG) + Open-Meteo weer
2. Meerdere camerabronnen (Rijkswaterstaat, OpenWebcamDB, webcam-autoroute)
3. Locatie info (Wikipedia API + Wikimedia Commons foto's)
4. Cloudflare Worker proxy (voor camera's met CORS)
5. Golden hour / zonsopgang-ondergang (SunCalc in-browser)
6. Radio (Radio Browser API)
7. Aardbevingen (USGS GeoJSON)
8. ISS (positie API + NASA HLS streams)
9. Aurora / noorderlicht (NOAA forecast)
10. Festivals / concerten / events (eigen JSON + YouTube embed/RSS)
11. Kastelen / monumenten / natuur (eigen JSON + Wikipedia)
12. UFO meldingen (NUFORC dataset)
13. Telescopen (ESO, VLA, Virtual Telescope, Space Telescope Live)
14. Roadtrip feature (OSRM routing + camera's langs route)
15. Three.js 3D globe toggle (optioneel, laatst)

## Niet doen

- Geen frameworks-op-frameworks (geen React, geen Vue, geen Angular)
- Geen API keys zoeken of aanvragen
- Geen continuous polling
- Geen RTSP camera's — alleen JPEG snapshots en HLS streams
- Geen scrapen van websites (breekbaar, TOS-problemen)
- Geen complexe state management libraries
- Geen features toevoegen die niet in blueprint.md staan
- Niet "even snel" iets bouwen zonder deze documenten te lezen
- Geen demo's of "proof of concept" — alles wat je bouwt moet het eindproduct zijn

## Bij problemen

- API bron offline → laag tonen als "niet beschikbaar", niet crashen
- CORS probleem → Cloudflare Worker proxy gebruiken
- Camera geeft geen beeld → toon info + weer + Wikipedia als fallback
- Twijfel over aanpak → lees blueprint.md of vraag de eigenaar
