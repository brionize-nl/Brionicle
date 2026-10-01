# CLAUDE.md — Brionicle AI Toolkit

## Eigenaar
Brionize (brionize.nl@gmail.com) — enige gebruiker. Geen publiek, geen multi-user.

## Toestemming
De eigenaar heeft vooraf toestemming gegeven voor alle acties. Niet steeds opnieuw vragen.
Citaat: "Daar heb je toch al toestemming voor. Ik wil niet weer alles opnieuw gaan goedkeuren."

## Project overzicht
Twee parallelle projecten:

### 1. Brionicle Wereldkaart (bestaand)
Interactieve wereldkaart met live camera's, weer, radio, events.
Zie AGENTS.md en blueprint.md voor architectuur en regels.

### 2. AI Toolkit op Oracle ARM VPS (nieuw, actief)
Zelfstandige digitale werkplaats: Claude + Ollama + gratis tools.
Doel: ALLE projecttypen zelf kunnen doen (websites, webshops, PWAs, automatisering, video, research, content).

## VPS Infrastructuur (Oracle ARM Ampere A1)
- **IP**: 84.235.182.106
- **OS**: Ubuntu 24.04 (aarch64, 2 cores, 12GB RAM, ~10GB disk vrij)
- **SSH**: `ssh ubuntu@84.235.182.106`
- **Domein**: ollama.brionize.nl (A-record bij Vimexx DirectAdmin)
- **Python venv**: ~/docu-env (PEP 668 vereist venv op Ubuntu 24.04)

### Actieve services op VPS
- **Ollama** (localhost:11434) — Llama 3.1 8B + DeepSeek-R1 8B
- **Caddy** (poort 80/443) — HTTPS reverse proxy naar Ollama, auto SSL via Let's Encrypt
- **Syncthing** (user service, poort 8384) — file sync VPS <-> Asus laptop

### Ollama configuratie (/etc/systemd/system/ollama.service.d/override.conf)
```
OLLAMA_NUM_PARALLEL=1
OLLAMA_MAX_LOADED_MODELS=1
OLLAMA_FLASH_ATTENTION=1
OLLAMA_ORIGINS=*
OLLAMA_HOST=0.0.0.0:11434
```

### Geinstalleerde Python tools (~/docu-env)
duckduckgo-search, piper-tts, torch, torchaudio, transformers, trafilatura, yt-dlp

### Firewall (iptables)
Poort 22 (SSH), 80 (HTTP), 443 (HTTPS) open. Opgeslagen via netfilter-persistent.

### DNS
- ollama.brionize.nl -> 84.235.182.106 (Vimexx DirectAdmin, DNS only, geen proxy)
- n8n.brionize.nl -> 84.235.182.106 (oud, kan weg)

## Taaksverdeling AI
- **Claude** = architect, complexe code, planning, multi-step taken
- **Ollama** (Llama 3.1 / DeepSeek-R1) = lokale repetitieve taken (narration, summaries, titles)
- **DuckDuckGo Chat** (Llama 70B) = gratis cloud AI voor zwaardere taken
- **VPS tools** = executie (Piper TTS, FFmpeg, yt-dlp, trafilatura)
- Ollama is GEEN concurrent van Claude — het is een teamlid voor specifieke taken

## Regels (niet-onderhandelbaar)
1. 100% gratis — geen betaalde diensten, geen API keys
2. Geen demo's — alleen werkend eindproduct
3. Simpele, rechte code — geen overbodige abstracties
4. On-demand — niets laden totdat de gebruiker erom vraagt
5. Eigengebruik — niet publiek

## Volgende stappen (in volgorde)
1. **Beveiliging** — API key toevoegen via Caddy (Ollama staat nu open)
2. **PWA bouwen** — Ollama interface met projecten, hosted op Cloudflare Pages
3. **Ollama config systeem** — ~/ollama-matrix/ met base.txt + tasks/ + projects/
4. **Docu-generator v3** — research + cloud AI + yt-dlp + volledig autonoom
5. **MusicGen script** — generate-music.py voor AI-gegenereerde muziek
6. **Research module** — DuckDuckGo search + web scraping + Ollama samenvatting

## Niet doen
- Geen Docker (bewust verwijderd, alles draait native)
- Geen frameworks-op-frameworks
- Geen continuous polling
- Geen scrapen van websites
- Niet opnieuw vragen om toestemming
- Repo wordt private gezet wanneer alles compleet is
