#!/bin/bash
# Brionicle VPS Setup - Oracle Cloud ARM64 (aarch64)
# Draait op de VPS zodat je Asus desktop niet belast wordt.

set -e

echo "=== Brionicle VPS Capture Setup (ARM64) ==="
echo ""

# Detecteer architectuur
ARCH=$(uname -m)
echo "Architectuur: $ARCH"
echo "OS: $(lsb_release -d 2>/dev/null | cut -f2 || cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
echo ""

# Installeer system Chromium (ARM64 - Puppeteer bundelt geen ARM64 build)
echo "Chromium installeren..."
sudo apt-get update -qq
sudo apt-get install -y -qq chromium-browser 2>/dev/null || sudo apt-get install -y -qq chromium 2>/dev/null
CHROME_PATH=$(which chromium-browser 2>/dev/null || which chromium 2>/dev/null)
echo "Chromium: $CHROME_PATH"
echo ""

# Chromium dependencies
sudo apt-get install -y -qq \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxcomposite1 libxdamage1 libxrandr2 \
    libgbm1 libasound2t64 libpango-1.0-0 libcairo2 \
    libxshmfence1 fonts-liberation xvfb 2>/dev/null
echo ""

# Node.js via nvm
if ! command -v node &> /dev/null; then
    echo "Node.js installeren via nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
fi
echo "Node.js: $(node -v)"
echo ""

# npm dependencies (skip Puppeteer Chromium download — we use system Chromium)
echo "NPM dependencies installeren (zonder Puppeteer Chromium download)..."
PUPPETEER_SKIP_DOWNLOAD=true npm install
echo ""

# Config
if [ ! -f config.json ]; then
    cp config.example.json config.json
    echo "config.json aangemaakt!"
    echo ""
    echo ">>> Vul je gegevens in en stel chromePath in:"
    echo "    nano config.json"
    echo ""
    echo "    \"chromePath\": \"$CHROME_PATH\""
    echo ""
else
    echo "config.json bestaat al"
    echo "Controleer dat chromePath goed staat:"
    echo "    \"chromePath\": \"$CHROME_PATH\""
fi

# Systemd service
NODE_PATH=$(which node)
WORK_DIR=$(pwd)

echo ""
echo "Systemd service instellen..."

sudo tee /etc/systemd/system/brionicle-capture.service > /dev/null << SVCEOF
[Unit]
Description=Brionicle Camera Capture (VPS)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$WORK_DIR
ExecStart=$NODE_PATH brionicle-capture.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=DISPLAY=:99

[Install]
WantedBy=multi-user.target
SVCEOF

sudo systemctl daemon-reload
sudo systemctl enable brionicle-capture

echo ""
echo "=== Setup klaar! ==="
echo ""
echo "Stappen:"
echo "  1. Vul config.json in met je R2 gegevens"
echo "  2. Test:  node brionicle-capture.js --debug"
echo "  3. Start: sudo systemctl start brionicle-capture"
echo "  4. Logs:  sudo journalctl -u brionicle-capture -f"
