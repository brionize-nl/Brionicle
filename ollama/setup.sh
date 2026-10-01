#!/bin/bash
# Setup script voor Ollama + Caddy op Oracle VPS
# Gebruik: sudo bash setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Ollama + Caddy setup ==="

# 1. Ollama installeren (als nog niet aanwezig)
if ! command -v ollama &> /dev/null; then
    echo "Ollama installeren..."
    curl -fsSL https://ollama.com/install.sh | sh
else
    echo "Ollama is al geinstalleerd: $(ollama --version)"
fi

# 2. Caddy installeren (als nog niet aanwezig)
if ! command -v caddy &> /dev/null; then
    echo "Caddy installeren..."
    apt-get update
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update
    apt-get install -y caddy
else
    echo "Caddy is al geinstalleerd: $(caddy version)"
fi

# 3. PWA bestanden kopieren
echo "PWA bestanden kopieren..."
mkdir -p /opt/ollama-pwa/public
cp -r "$SCRIPT_DIR/public/"* /opt/ollama-pwa/public/

# 4. API key genereren of bestaande gebruiken
KEY_FILE="/etc/caddy/ollama-api-key"
if [ -f "$KEY_FILE" ]; then
    API_KEY=$(cat "$KEY_FILE")
    echo "Bestaande API key gevonden"
else
    API_KEY=$(openssl rand -hex 32)
    echo "$API_KEY" > "$KEY_FILE"
    chmod 600 "$KEY_FILE"
    echo ""
    echo "=== BEWAAR DEZE API KEY ==="
    echo "$API_KEY"
    echo "==========================="
    echo ""
fi

# 5. Caddyfile met API key erin (geen env var — Caddy matcher bug)
echo "Caddyfile installeren..."
sed "s/__OLLAMA_API_KEY__/$API_KEY/g" "$SCRIPT_DIR/Caddyfile" > /etc/caddy/ollama.caddyfile

if ! grep -q 'import.*ollama.caddyfile' /etc/caddy/Caddyfile 2>/dev/null; then
    echo 'import /etc/caddy/ollama.caddyfile' >> /etc/caddy/Caddyfile
    echo "Import regel toegevoegd aan /etc/caddy/Caddyfile"
else
    echo "Import regel bestaat al in /etc/caddy/Caddyfile"
fi

# 6. Ollama configureren: alleen localhost + alle origins toestaan (Caddy doet de auth)
mkdir -p /etc/systemd/system/ollama.service.d
cat > /etc/systemd/system/ollama.service.d/override.conf << 'EOF'
[Service]
Environment="OLLAMA_HOST=127.0.0.1:11434"
Environment="OLLAMA_ORIGINS=*"
EOF

# 7. Firewall: alleen 80 en 443 open voor Caddy
echo "Firewall configureren..."
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
fi

# 8. Services herstarten
echo "Services herstarten..."
systemctl daemon-reload
systemctl enable ollama
systemctl restart ollama
systemctl enable caddy
systemctl restart caddy

echo ""
echo "=== Diagnose ==="
sleep 2
echo -n "Ollama lokaal: "
OLLAMA_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:11434/api/tags 2>/dev/null)
echo "$OLLAMA_STATUS"
if [ "$OLLAMA_STATUS" != "200" ]; then
    echo "WAARSCHUWING: Ollama reageert niet op localhost:11434"
    echo "Controleer: sudo systemctl status ollama"
fi

echo -n "Caddy proxy:   "
CADDY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: $API_KEY" https://ollama.brionize.nl/api/tags 2>/dev/null)
echo "$CADDY_STATUS"

echo ""
echo "=== Setup compleet ==="
echo "Ollama draait op localhost:11434"
echo "Caddy proxy op ollama.brionize.nl (HTTPS automatisch)"
echo "API key staat in $KEY_FILE"
