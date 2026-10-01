#!/bin/bash
# Brionicle VPS Cleanup — Oracle ARM Ampere
# Doel: VPS volledig inrichten voor Ollama + AI toolkit
# Stopt n8n, Caddy, SearXNG en onnodige services
set -e

BACKUP_DIR="$HOME/vps-backup-$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

echo "==========================================="
echo "  BRIONICLE VPS CLEANUP"
echo "  Backup dir: $BACKUP_DIR"
echo "==========================================="
echo ""

# --- 1. BACKUP ---
echo ">> STAP 1: Backup maken..."

# n8n workflows
echo "   n8n workflows exporteren..."
docker exec n8n-n8n-1 n8n export:workflow --all --output=/tmp/n8n-workflows.json 2>/dev/null && \
    docker cp n8n-n8n-1:/tmp/n8n-workflows.json "$BACKUP_DIR/n8n-workflows.json" && \
    echo "   ✓ Workflows opgeslagen" || \
    echo "   ! Geen workflows gevonden of n8n niet bereikbaar"

# n8n credentials
echo "   n8n credentials exporteren..."
docker exec n8n-n8n-1 n8n export:credentials --all --output=/tmp/n8n-credentials.json 2>/dev/null && \
    docker cp n8n-n8n-1:/tmp/n8n-credentials.json "$BACKUP_DIR/n8n-credentials.json" && \
    echo "   ✓ Credentials opgeslagen" || \
    echo "   ! Geen credentials gevonden"

# Caddy config + domein info
echo "   Caddy config opslaan..."
docker exec n8n-caddy-1 cat /etc/caddy/Caddyfile > "$BACKUP_DIR/Caddyfile" 2>/dev/null && \
    echo "   ✓ Caddyfile opgeslagen" || \
    echo "   ! Caddy niet bereikbaar"

# Domein info
cat > "$BACKUP_DIR/domein-info.txt" << 'DOMEIN'
=== BRIONIZE DOMEIN INFO ===
Domein: n8n.brionize.nl
VPS IP: 84.235.182.106
Gebruik: Was reverse proxy naar n8n (port 5678)
Caddy: Automatische SSL via Let's Encrypt
DNS: A-record n8n.brionize.nl -> 84.235.182.106
Actie: DNS aanpassen bij registrar als je het domein wilt hergebruiken
DOMEIN
echo "   ✓ Domein info opgeslagen"

# n8n docker-compose (als het bestaat)
if [ -f "$HOME/n8n/docker-compose.yml" ]; then
    cp "$HOME/n8n/docker-compose.yml" "$BACKUP_DIR/docker-compose.yml"
    echo "   ✓ docker-compose.yml opgeslagen"
fi
if [ -d "$HOME/n8n" ]; then
    cp -r "$HOME/n8n" "$BACKUP_DIR/n8n-config" 2>/dev/null && \
        echo "   ✓ n8n config map opgeslagen" || true
fi

# Backup naar git repo voor veiligheid (zonder secrets)
cp "$BACKUP_DIR/domein-info.txt" "$HOME/Brionicle/tools/domein-info.txt" 2>/dev/null || true
cp "$BACKUP_DIR/Caddyfile" "$HOME/Brionicle/tools/Caddyfile.backup" 2>/dev/null || true

echo ""
echo ">> STAP 2: Docker containers stoppen..."

# Stop alle containers
docker stop searxng 2>/dev/null && echo "   ✓ SearXNG gestopt" || echo "   - SearXNG was al gestopt"
docker stop n8n-n8n-1 2>/dev/null && echo "   ✓ n8n gestopt" || echo "   - n8n was al gestopt"
docker stop n8n-caddy-1 2>/dev/null && echo "   ✓ Caddy gestopt" || echo "   - Caddy was al gestopt"

echo ""
echo ">> STAP 3: Docker containers verwijderen..."
docker rm searxng 2>/dev/null && echo "   ✓ SearXNG verwijderd" || true
docker rm n8n-n8n-1 2>/dev/null && echo "   ✓ n8n verwijderd" || true
docker rm n8n-caddy-1 2>/dev/null && echo "   ✓ Caddy verwijderd" || true

echo ""
echo ">> STAP 4: Docker images opruimen (disk space)..."
docker image prune -a -f
echo "   ✓ Ongebruikte images verwijderd"

echo ""
echo ">> STAP 5: Docker zelf stoppen (niet meer nodig)..."
sudo systemctl stop docker.socket
sudo systemctl stop docker
sudo systemctl stop containerd
sudo systemctl disable docker.socket
sudo systemctl disable docker
sudo systemctl disable containerd
echo "   ✓ Docker gestopt en uitgeschakeld"

echo ""
echo ">> STAP 6: Onnodige services stoppen..."

SERVICES_TO_STOP=(
    "ModemManager"
    "wpa_supplicant"
    "iscsid"
    "rpcbind"
    "fwupd"
    "udisks2"
    "multipathd"
)

for svc in "${SERVICES_TO_STOP[@]}"; do
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
        sudo systemctl stop "$svc"
        sudo systemctl disable "$svc"
        echo "   ✓ $svc gestopt"
    else
        echo "   - $svc was al inactief"
    fi
done

# CUPS (snap-based)
if systemctl is-active --quiet "snap.cups.cupsd" 2>/dev/null; then
    sudo snap stop cups 2>/dev/null && echo "   ✓ CUPS gestopt" || true
    sudo snap disable cups 2>/dev/null && echo "   ✓ CUPS uitgeschakeld" || true
fi

echo ""
echo ">> STAP 7: Swap configureren (voorkomt crashes)..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 4G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
    echo "   ✓ 4GB swap aangemaakt en geactiveerd"
else
    echo "   - Swap bestaat al"
fi

echo ""
echo ">> STAP 8: Python tools installeren..."
VENV="$HOME/docu-env"
if [ -d "$VENV" ]; then
    "$VENV/bin/pip" install -q duckduckgo-search trafilatura yt-dlp 2>/dev/null && \
        echo "   ✓ duckduckgo-search, trafilatura, yt-dlp geinstalleerd" || \
        echo "   ! Pip install mislukt, handmatig proberen"
else
    echo "   ! Venv niet gevonden op $VENV"
fi

echo ""
echo ">> STAP 9: DeepSeek-R1 downloaden..."
if command -v ollama &> /dev/null; then
    echo "   Dit duurt ~5 minuten..."
    ollama pull deepseek-r1:8b && echo "   ✓ DeepSeek-R1 8B gedownload" || \
        echo "   ! Download mislukt, later proberen met: ollama pull deepseek-r1:8b"
fi

echo ""
echo ">> STAP 10: Ollama tunen voor ARM..."
cat > "$HOME/.ollama_env" << 'OLLAMA_ENV'
# Ollama optimalisatie voor Oracle ARM (2 cores, 12GB)
OLLAMA_NUM_PARALLEL=1
OLLAMA_MAX_LOADED_MODELS=1
OLLAMA_FLASH_ATTENTION=1
OLLAMA_ENV

sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/override.conf > /dev/null << 'OVERRIDE'
[Service]
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_FLASH_ATTENTION=1"
OVERRIDE

sudo systemctl daemon-reload
sudo systemctl restart ollama
echo "   ✓ Ollama geoptimaliseerd en herstart"

echo ""
echo "==========================================="
echo "  CLEANUP COMPLEET"
echo "==========================================="
echo ""
echo "  Backup:     $BACKUP_DIR"
echo "  Domein:     n8n.brionize.nl (DNS bewaard)"
echo ""

# Status rapport
echo "  --- RESOURCES ---"
echo "  RAM vrij:   $(free -h | awk '/Mem:/ {print $4}')"
echo "  Swap:       $(free -h | awk '/Swap:/ {print $2}')"
echo "  Disk vrij:  $(df -h / | awk 'NR==2 {print $4}')"
echo ""
echo "  --- ACTIEVE AI SERVICES ---"
systemctl is-active ollama &>/dev/null && echo "  Ollama:     ✓ actief" || echo "  Ollama:     ✗ inactief"
echo ""
echo "  --- GEINSTALLEERDE MODELLEN ---"
ollama list 2>/dev/null || echo "  (ollama niet bereikbaar)"
echo ""
echo "  --- PYTHON TOOLS ---"
"$HOME/docu-env/bin/pip" list 2>/dev/null | grep -E "duckduckgo|trafilatura|yt-dlp|piper" || true
echo ""
echo "==========================================="
echo "  VPS is nu klaar voor AI werk"
echo "==========================================="
