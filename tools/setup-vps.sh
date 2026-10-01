#!/bin/bash
# Brionicle Documentary Generator — VPS Setup (Oracle ARM Ampere)
set -e

echo "=== Brionicle Docu-Generator Setup ==="
echo ""

# 1. System packages
echo ">> FFmpeg installeren..."
sudo apt-get update -qq
sudo apt-get install -y -qq ffmpeg espeak-ng python3-pip

# 2. Python dependencies
echo ">> Python packages installeren..."
pip3 install --user piper-tts moviepy

# 3. Piper Dutch voice model
echo ">> Nederlands stemmodel downloaden..."
VOICE_DIR="$HOME/.local/share/piper-voices"
mkdir -p "$VOICE_DIR"
if [ ! -f "$VOICE_DIR/nl_NL-mls-medium.onnx" ]; then
    curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/main/nl/nl_NL/mls/medium/nl_NL-mls-medium.onnx" \
        -o "$VOICE_DIR/nl_NL-mls-medium.onnx"
    curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/main/nl/nl_NL/mls/medium/nl_NL-mls-medium.onnx.json" \
        -o "$VOICE_DIR/nl_NL-mls-medium.onnx.json"
    echo "   Stemmodel gedownload"
else
    echo "   Stemmodel al aanwezig"
fi

# 4. Ollama
echo ">> Ollama installeren..."
if ! command -v ollama &> /dev/null; then
    curl -fsSL https://ollama.com/install.sh | sh
    echo "   Ollama geinstalleerd"
else
    echo "   Ollama al aanwezig"
fi

# 5. Pull Llama 3.1 8B model
echo ">> Llama 3.1 8B model downloaden (~5GB, kan even duren)..."
ollama pull llama3.1:8b

# 6. Output directory
mkdir -p "$HOME/Brionicle/output"

echo ""
echo "=== Setup compleet ==="
echo ""
echo "Test het:"
echo "  python3 ~/Brionicle/tools/docu-generator.py --test"
echo ""
echo "Genereer een documentaire:"
echo "  python3 ~/Brionicle/tools/docu-generator.py playlist.json"
