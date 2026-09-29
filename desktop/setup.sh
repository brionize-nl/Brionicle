#!/bin/bash
# Brionicle Desktop Capture - Setup voor Linux

echo "=== Brionicle Desktop Capture Setup ==="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js niet gevonden. Installeren via nvm..."
    echo ""
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install --lts
    nvm use --lts
    echo ""
fi

echo "Node.js: $(node -v)"
echo "npm:     $(npm -v)"
echo ""

# Install Chromium dependencies (Debian/Ubuntu)
if command -v apt-get &> /dev/null; then
    echo "Chromium dependencies installeren..."
    sudo apt-get update -qq
    sudo apt-get install -y -qq \
        libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
        libdrm2 libxcomposite1 libxdamage1 libxrandr2 \
        libgbm1 libasound2 libpango-1.0-0 libcairo2 \
        libxshmfence1 fonts-liberation 2>/dev/null
    echo ""
fi

# Install npm dependencies
echo "NPM dependencies installeren..."
npm install
echo ""

# Config
if [ ! -f config.json ]; then
    cp config.example.json config.json
    echo "config.json aangemaakt!"
    echo ""
    echo ">>> Vul nu je gegevens in: nano config.json"
    echo ""
    echo "Je hebt nodig:"
    echo "  1. Cloudflare Account ID (dash.cloudflare.com rechtsonder)"
    echo "  2. R2 bucket 'brionicle-live' aanmaken (dash.cloudflare.com -> R2)"
    echo "  3. R2 API token aanmaken (R2 -> Manage R2 API Tokens)"
    echo "     - Kies 'Object Read & Write'"
    echo "     - Noteer Access Key ID en Secret Access Key"
else
    echo "config.json bestaat al"
fi

echo ""
echo "=== Setup klaar! ==="
echo ""
echo "Starten:     node brionicle-capture.js"
echo "Debug mode:  node brionicle-capture.js --debug"
echo "Als service: sudo cp brionicle-capture.service /etc/systemd/system/"
echo "             sudo systemctl enable brionicle-capture"
echo "             sudo systemctl start brionicle-capture"
