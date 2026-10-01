#!/bin/bash
# Fix Caddy firewall + SSL for ollama.brionize.nl
set -e

echo "=== DIAGNOSE ==="

echo ""
echo ">> 1. Controleer of Caddy draait..."
systemctl is-active caddy && echo "   ✓ Caddy actief" || echo "   ✗ Caddy NIET actief"

echo ""
echo ">> 2. Controleer of Ollama lokaal bereikbaar is..."
curl -s -o /dev/null -w "   Ollama HTTP status: %{http_code}\n" http://localhost:11434/ || echo "   ✗ Ollama niet bereikbaar"

echo ""
echo ">> 3. Controleer of poort 80 en 443 luisteren..."
sudo ss -tlnp | grep -E ':80 |:443 ' || echo "   ✗ Geen service op poort 80/443"

echo ""
echo ">> 4. Huidige iptables INPUT regels..."
sudo iptables -L INPUT -n --line-numbers

echo ""
echo "=== FIX TOEPASSEN ==="

echo ""
echo ">> 5. Alle oude regels voor 80/443 verwijderen..."
while sudo iptables -D INPUT -m state --state NEW -p tcp --dport 80 -j ACCEPT 2>/dev/null; do true; done
while sudo iptables -D INPUT -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null; do true; done

echo ""
echo ">> 6. Regels toevoegen BOVENAAN de chain (positie 1)..."
sudo iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
echo "   ✓ Poort 80 en 443 geopend (positie 1)"

echo ""
echo ">> 7. Opslaan..."
sudo netfilter-persistent save
echo "   ✓ Firewall regels opgeslagen"

echo ""
echo ">> 8. Caddy SSL data resetten en herstarten..."
sudo systemctl stop caddy
sudo rm -rf /var/lib/caddy/.local/share/caddy/acme 2>/dev/null || true
sudo rm -rf /var/lib/caddy/.local/share/caddy/certificates 2>/dev/null || true
sudo rm -rf /var/lib/caddy/.local/share/caddy/locks 2>/dev/null || true
sudo systemctl start caddy
echo "   ✓ Caddy herstart met schone SSL state"

echo ""
echo ">> 9. Wachten op SSL certificaat (max 30 sec)..."
for i in $(seq 1 6); do
    sleep 5
    RESULT=$(curl -s -o /dev/null -w "%{http_code}" https://ollama.brionize.nl/ 2>/dev/null || echo "000")
    echo "   Poging $i: HTTP $RESULT"
    if [ "$RESULT" != "000" ]; then
        echo ""
        echo "=== SUCCES ==="
        echo "   ✓ https://ollama.brionize.nl/ is bereikbaar!"
        curl -s https://ollama.brionize.nl/api/tags 2>/dev/null | python3 -m json.tool 2>/dev/null | head -10 || true
        exit 0
    fi
done

echo ""
echo "=== NOG NIET WERKEND ==="
echo ""
echo "SSL certificaat nog niet gelukt. Check:"
echo "  1. Oracle Cloud Console → Networking → VCN → Security Lists"
echo "     → Ingress Rules: voeg poort 80 (TCP) en 443 (TCP) toe van 0.0.0.0/0"
echo "  2. Caddy logs: sudo journalctl -u caddy --no-pager -n 10"
echo ""
echo "Huidige iptables (na fix):"
sudo iptables -L INPUT -n --line-numbers | head -15
