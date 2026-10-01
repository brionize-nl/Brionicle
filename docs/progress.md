# Progress — Brionicle

Laatst bijgewerkt: 2026-10-01

---

## Track A: Wereldkaart

### Fase 0: Sparren en plannen — AFGEROND
Alle onderdelen afgerond.

### Fase 1: Skelet — GROTENDEELS AFGEROND
| Stap | Status |
|------|--------|
| PWA basis (index.html, manifest, service worker) | Afgerond |
| Leaflet 2D kaart laden | Afgerond |
| 1 camerabron integreren (RWS API + fallback) | Afgerond |
| Open-Meteo weer bij klik | Afgerond |
| Golden hour / zonsopgang-ondergang | Afgerond |
| Basis pin UI (klik -> info paneel) | Afgerond |
| Lagen toggle UI | Afgerond |
| PWA iconen | Afgerond |
| Deploy naar Cloudflare Pages | Afgerond |
| Testen op desktop + mobiel | Lopend |

### Fase 2: Camera bronnen uitbreiden — DEELS
| Stap | Status |
|------|--------|
| RWS camera's via API | Werkt |
| Extra bronnen (Windy, webcam-autoroute) | Niet gestart |
| Camera health check | Niet gestart |

### Fase 3-13: Info, proxy, golden hour, radio, aardbevingen, ISS, aurora, events, monumenten, UFO, telescopen — AFGEROND
Alle fases afgerond. Sommige features later verwijderd (ISS, UFO, aardbevingen, radio, aurora, pins, roadtrip) - zie PROGRESS.md root.

### Fase 14: Roadtrip — VERWIJDERD
### Fase 15: 3D globe — NIET GESTART

### Actieve features (na cleanup)
1. Verkeerscamera's (RWS + timelapse + live)
2. Vliegtuigradar (ADS-B + routes + volgen)
3. Weer bij klik (Open-Meteo + zontijden)

---

## Track B: AI Toolkit (VPS)

### Fase 1: VPS Setup — AFGEROND (2026-10-01)
| Stap | Status |
|------|--------|
| Ollama installatie + Llama 3.1 8B | Afgerond |
| DeepSeek-R1 8B downloaden | Afgerond |
| Piper TTS (EN + NL stemmen) | Afgerond |
| Python venv (~/docu-env) | Afgerond |
| duckduckgo-search installatie | Afgerond |
| trafilatura installatie | Afgerond |
| yt-dlp installatie | Afgerond |
| FFmpeg (system) | Afgerond |

### Fase 2: VPS Cleanup — AFGEROND (2026-10-01)
| Stap | Status |
|------|--------|
| n8n backup (workflows + credentials) | Afgerond |
| Docker containers stoppen + verwijderen | Afgerond |
| Docker/containerd uitschakelen | Afgerond |
| Onnodige services stoppen | Afgerond |
| 4GB swap configureren | Afgerond |
| Syncthing installeren + service | Afgerond |
| MusicGen dependencies (torch + transformers) | Afgerond |
| Ollama tuning voor ARM | Afgerond |

### Fase 3: Netwerk/Domein — AFGEROND (2026-10-01)
| Stap | Status |
|------|--------|
| DNS ollama.brionize.nl bij Vimexx | Afgerond |
| Caddy installatie (apt) | Afgerond |
| SSL certificaat (Let's Encrypt) | Afgerond |
| Firewall fix (iptables poort 80/443) | Afgerond |
| OLLAMA_ORIGINS=* (CORS) | Afgerond |
| OLLAMA_HOST=0.0.0.0 | Afgerond |
| https://ollama.brionize.nl/ bereikbaar | Afgerond |

### Fase 4: Beveiliging — NIET GESTART
| Stap | Status |
|------|--------|
| API key via Caddy header auth | Niet gestart |
| Rate limiting | Niet gestart |

### Fase 5: Ollama PWA — NIET GESTART
| Stap | Status |
|------|--------|
| PWA ontwerp (chat interface met projecten) | Niet gestart |
| Frontend bouwen (vanilla JS) | Niet gestart |
| Deploy naar Cloudflare Pages | Niet gestart |
| Project systeem (zoals ChatGPT/Claude) | Niet gestart |

### Fase 6: Ollama Config Systeem — NIET GESTART
| Stap | Status |
|------|--------|
| ~/ollama-matrix/base.txt (grondwet) | Niet gestart |
| Per-task configs (narrator, researcher, etc.) | Niet gestart |
| Per-project configs | Niet gestart |
| Modelfiles voor specifieke taken | Niet gestart |

### Fase 7: Docu-generator v3 — NIET GESTART
| Stap | Status |
|------|--------|
| Research module (DDG + trafilatura + Ollama) | Niet gestart |
| Cloud AI integratie (DuckDuckGo Chat) | Niet gestart |
| yt-dlp video b-roll | Niet gestart |
| Volledig autonome pipeline | Niet gestart |

### Fase 8: MusicGen — NIET GESTART
| Stap | Status |
|------|--------|
| generate-music.py script | Niet gestart |
| Muziekbibliotheek vullen | Niet gestart |

---

## Docu-generator (bestaand)

| Versie | Status |
|--------|--------|
| v1 (docu-generator.py) | Werkend, basis |
| v2 (docu-generator-v2.py) | Werkend, met subtitles, Ken Burns, xfade |
| v3 (gepland) | Research + cloud AI + yt-dlp + autonoom |

---

## Bugfixes
| Bug | Status |
|------|--------|
| Radio.toggle onbestaand event object | Gefixt |
| ISS click handler verouderde positie | Gefixt |
| Caddy SSL: iptables regels na REJECT | Gefixt (positie 1) |
| Ollama 403 vanuit browser | Gefixt (OLLAMA_ORIGINS=*) |
