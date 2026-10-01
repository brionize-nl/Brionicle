# Brionicle — Handoff Blueprint

**Laatste update:** 2026-10-01
**Status:** 3 core features (wereldkaart) + VPS AI toolkit operationeel

## Project

Brionicle is een persoonlijke interactieve wereldkaart PWA + AI toolkit.
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
Oracle VPS (84.235.182.106) — AI toolkit + documentaire generator
```

## Features (3 actief op wereldkaart)

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
- **Functies:** SVG markers, classificatie, infopanel, route A-B, volgen, teller

### 3. Weer bij klik
- **Bron:** Open-Meteo (weer) + sunrisesunset.io (zontijden)
- **Frontend:** `js/weather.js` (~73 regels)

## VPS AI Toolkit (Oracle ARM Ampere A1)

### Infrastructuur
- **IP:** 84.235.182.106
- **OS:** Ubuntu 24.04 (aarch64, 2 cores, 12GB RAM)
- **Domein:** ollama.brionize.nl (HTTPS via Caddy + Let's Encrypt)
- **Python venv:** ~/docu-env

### Actieve services
| Service | Status | Doel |
|---------|--------|------|
| Ollama | Actief | AI modellen (Llama 3.1 8B + DeepSeek-R1 8B) |
| Caddy | Actief | HTTPS reverse proxy voor Ollama API |
| Syncthing | Actief | File sync VPS <-> Asus laptop |

### Geinstalleerde tools
| Tool | Versie | Doel |
|------|--------|------|
| duckduckgo-search | 8.1.1 | Web search (vervangt SearXNG) |
| piper-tts | 1.8.0 | Text-to-speech (EN + NL) |
| torch | 2.14.1 | AI framework (MusicGen) |
| transformers | 5.18.0 | AI modellen (MusicGen) |
| trafilatura | 2.2.0 | Web scraping / tekst extractie |
| yt-dlp | 2026.8.19 | Video download (eigengebruik) |
| ffmpeg | system | Video/audio processing |

### Verwijderd van VPS (cleanup 2026-10-01)
- Docker + containerd (gestopt, uitgeschakeld)
- n8n (workflows gebackupt)
- Caddy Docker container (vervangen door native Caddy)
- SearXNG (vervangen door duckduckgo-search)
- Onnodige services: ModemManager, wpa_supplicant, iscsid, rpcbind, fwupd, udisks2, multipathd, CUPS

### VPS Configuratie
- Ollama: OLLAMA_NUM_PARALLEL=1, OLLAMA_MAX_LOADED_MODELS=1, OLLAMA_FLASH_ATTENTION=1, OLLAMA_ORIGINS=*, OLLAMA_HOST=0.0.0.0:11434
- Firewall: poort 22/80/443 open (iptables, positie 1-2)
- Swap: 4GB
- DNS: ollama.brionize.nl A-record bij Vimexx DirectAdmin (geen proxy)

## Taaksverdeling AI
- **Claude** = architect, complexe code, planning, multi-step taken
- **Ollama** (Llama 3.1 / DeepSeek-R1) = lokale repetitieve taken (narration, summaries, titles)
- **DuckDuckGo Chat** (Llama 70B) = gratis cloud AI voor zwaardere taken
- **VPS tools** = executie (Piper TTS, FFmpeg, yt-dlp, trafilatura)

## Infra

| Dienst | Doel | Kosten |
|--------|------|--------|
| Cloudflare Pages | Frontend + Functions | Gratis |
| Cloudflare R2 | Camera opslag (bucket: `brionicle-live`) | Gratis tier |
| Oracle Cloud VPS | AI toolkit + services | Gratis tier (ARM64) |
| ADS-B.lol | Vliegtuigdata | Gratis, geen key |
| Open-Meteo | Weerdata | Gratis, geen key |
| RWS API | Camera's | Gratis, geen key |
| Ollama | Lokale AI modellen | Gratis, lokaal |
| Caddy | HTTPS reverse proxy | Gratis, auto SSL |
| Syncthing | File sync | Gratis, P2P |

**VPS IP:** `84.235.182.106` (hostname: `n8n-vm`, Ubuntu 24.04)
**VPS Brionicle pad:** `~/Brionicle` (hoofdletter B)

## Beveiliging

- R2 API keys en Cloudflare tokens NOOIT in code
- `desktop/config.json` staat in `.gitignore`
- Ollama staat open op ollama.brionize.nl (API key via Caddy toevoegen = volgende stap)

## Commit historie (huidige sessie - ccr-2735ea33-oh9eqa)

1. `58294a1` — Subtitle support voor docu-generator-v2
2. `37d991c` — VPS cleanup script (12 stappen) + Syncthing + MusicGen
3. `31e967b` — Caddy firewall diagnose en fix script
4. `fc84b60` — CLAUDE.md + .claude/settings.json
5. (deze commit) — Progress en blueprint updates

## Volgende stappen

### AI Toolkit (prioriteit)
1. Beveiliging: API key toevoegen via Caddy voor Ollama
2. PWA bouwen: Ollama interface met projecten (Cloudflare Pages)
3. Ollama config systeem: ~/ollama-matrix/ met base.txt + tasks/ + projects/
4. Docu-generator v3: research + cloud AI + yt-dlp + autonoom
5. MusicGen script: generate-music.py
6. Research module: DuckDuckGo + web scraping + Ollama

### Wereldkaart
- Weer en zontijden reviewen op kwaliteit
- Camera timelapse en VPS-integratie stabieler maken
- UI/UX polish (animaties, mobiel)
