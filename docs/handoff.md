# Handoff — Brionicle

Dit document is voor elke AI of ontwikkelaar die dit project oppakt. Lees dit EERST.

Laatst bijgewerkt: 2026-10-03

---

## Wat is Brionicle?

Een persoonlijke PWA die een interactieve wereldkaart toont met live verkeerscamera's, vliegtuigradar en weer. Gebouwd voor één persoon (Brionize), draait 100% gratis.

## Huidige staat

3 actieve features, productie op Cloudflare Pages (`brionicle.pages.dev`).

| Feature | Bron | Werkt? |
|---------|------|--------|
| Verkeerscamera's | RWS API + R2 + VPS screenshots | ✅ |
| Vliegtuigradar | ADS-B.lol + adsbdb.com | ✅ |
| Weer bij klik | Open-Meteo + sunrisesunset.io | ✅ |

## Wat is er al besloten?

Alles. De volledige sparfase is afgerond. Lees deze documenten:

| Document | Wat het bevat |
|----------|--------------|
| **AGENTS.md** (repo root) | Regels en restricties voor elke AI die hieraan werkt |
| **docs/blueprint.md** | Architectuur, databronnen, bestandsstructuur, infra |
| **docs/progress.md** | Wat af is, wat verwijderd is, en wat nog moet |

## Kernprincipes

1. **On-demand**: niets laden totdat de gebruiker erom vraagt
2. **Geen API keys**: alle bronnen zijn gratis en keyless
3. **Elke laag onafhankelijk**: als één bron doodgaat, draait de rest door
4. **100% gratis**: Cloudflare Pages, R2, Oracle VPS — alles gratis tier

## Tech stack

- **Frontend**: Vanilla HTML/CSS/JS (geen frameworks)
- **Kaart**: Leaflet (2D)
- **Video**: HLS.js voor camera streams
- **Hosting**: Cloudflare Pages (frontend + serverless functions)
- **Opslag**: Cloudflare R2 (camera screenshots, timelapse)
- **VPS**: Oracle ARM64 (desktop screenshot service)
- **Geen**: database, backend server, auth, API keys, Node.js server, React/Vue/Angular

## De eigenaar

- Brionize, enige gebruiker
- Samsung Galaxy S22 Ultra (12GB RAM)
- Wil werkend product, geen demo's of prototypes
- Communicatie: Nederlands

## Hoe verder bouwen

1. Check `docs/progress.md` voor de huidige status
2. Check `docs/blueprint.md` voor architectuur en databronnen
3. Volg de regels in `AGENTS.md`
4. Bouw één laag volledig af voordat je aan de volgende begint
5. Test op desktop EN mobiel
6. Update `docs/progress.md` bij elke voltooide stap

## Veelgemaakte fouten (niet doen)

- "Laat ik eerst een snelle demo maken" → NEE. Lees AGENTS.md regel 1.
- "Ik gebruik even een API key" → NEE. Alles gratis en keyless.
- "Ik poll elke 30 seconden" → NEE. On-demand, alleen bij klik.
- "Ik installeer React" → NEE. Vanilla JS, geen build stap.

## DELPHI (apart project)

Ollama PWA is verhuisd naar eigen repo: `brionize-nl/DELPHI`
Draait op `ollama.brionize.nl` — zie die repo voor documentatie.
