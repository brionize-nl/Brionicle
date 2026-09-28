# Handoff — Brionicle

Dit document is voor elke AI of ontwikkelaar die dit project oppakt. Lees dit EERST.

---

## Wat is Brionicle?

Een persoonlijke PWA (Progressive Web App) die een interactieve wereldkaart toont met live camera's, weer, radio, events, aardbevingen, ISS, telescopen en meer. Gebouwd voor één persoon (Brionize), draait 100% gratis.

## Wat is er al besloten?

Alles. De volledige sparfase is afgerond. Lees deze documenten:

| Document | Wat het bevat |
|----------|--------------|
| **AGENTS.md** (repo root) | Regels en restricties voor elke AI die hieraan werkt |
| **docs/blueprint.md** | Alle technische details, databronnen, architectuur |
| **docs/progress.md** | Wat af is en wat nog moet |

## Kernprincipes

1. **On-demand**: niets laden totdat de gebruiker erom vraagt. Info eerst (altijd beschikbaar), media bij klik.
2. **Geen API keys**: alle bronnen zijn gratis en keyless.
3. **Elke laag onafhankelijk**: als één bron doodgaat, draait de rest door.
4. **Universeel pin-patroon**: alles (camera, festival, kasteel, telescoop) is een pin op de kaart met hetzelfde klik-gedrag.
5. **Eigen data in JSON**: festivals, monumenten, YouTube kanalen, UFO meldingen — allemaal eigen JSON bestanden, geen externe APIs nodig.

## Tech stack

- **Frontend**: Vanilla HTML/CSS/JS (geen React/Vue/Angular)
- **Kaart**: Leaflet (2D standaard), Three.js (3D optioneel toggle)
- **Video**: HLS.js voor HLS streams, YouTube embed
- **Audio**: `<audio>` tag voor radio
- **Hosting**: Cloudflare Pages
- **Proxy**: Cloudflare Worker (alleen voor CORS bij camera-beelden)
- **Health checks**: GitHub Actions
- **Geen**: database, backend server, auth, API keys, Node.js server

## De eigenaar

- Brionize, enige gebruiker
- Heeft Samsung Galaxy S22 Ultra (12GB RAM) — 3D globe toggle is een optie
- Wil geen "continu fixen" — robuuste, simpele code
- Wil werkend product, geen demo's of prototypes
- Taal voorkeur in de app: maakt niet uit (Engels is prima)
- Communicatie: Nederlands

## Hoe verder bouwen

1. Check docs/progress.md voor de huidige status
2. Volg de bouwvolgorde in AGENTS.md
3. Bouw één laag volledig af voordat je aan de volgende begint
4. Test elke laag op desktop EN mobiel (PWA)
5. Commit en push na elke voltooide laag
6. Update docs/progress.md bij elke voltooide stap

## Veelgemaakte fouten (niet doen)

- "Laat ik eerst een snelle demo maken" → NEE. Lees AGENTS.md regel 1.
- "Ik gebruik even de YouTube Data API" → NEE. Gebruik RSS feeds en embeds. Geen API keys.
- "Ik poll elke 30 seconden alle camera's" → NEE. On-demand. Alleen bij klik.
- "Ik installeer React/Next.js/Vite" → NEE. Vanilla JS. Geen build stap nodig.
- "Deze API bron bestaat niet meer, ik zoek een alternatief" → prima, maar documenteer het in blueprint.md en overleg met de eigenaar.
