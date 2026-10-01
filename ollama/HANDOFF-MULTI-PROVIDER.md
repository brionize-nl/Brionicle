# Handoff: Multi-Provider AI Chat PWA

## Doel
Breid de bestaande Ollama PWA uit zodat deze naast lokale Ollama modellen ook Claude, ChatGPT en Mistral ondersteunt. Alle API keys worden server-side afgehandeld via Caddy reverse proxy.

## Huidige staat

### Repo & branch
- Repo: `brionize-nl/Brionicle`
- Branch: `claude/ollama-security-pwa-w3j5lj`
- PWA locatie: `ollama/public/index.html` (enkele HTML file, geen framework)
- Proxy config: `ollama/Caddyfile` (template met `__OLLAMA_API_KEY__` placeholder)
- Deploy script: `ollama/setup.sh` (draait op Ubuntu VPS, kopieert files, configureert Caddy)
- Live URL: `ollama.brionize.nl`

### Huidige architectuur
```
Browser (PWA) ──► Caddy (VPS) ──► Ollama (localhost:11434)
                    │
                    └── Auth via X-API-Key header
```

- Gebruiker stuurt `X-API-Key` header mee bij elk request
- Caddy checkt de key, blockt met 401 als die niet klopt
- Caddy proxyt naar Ollama op localhost:11434
- Ollama draait met OLLAMA_HOST=127.0.0.1:11434 en OLLAMA_ORIGINS=*

### Bestanden die je moet aanpassen
1. `ollama/public/index.html` — de volledige PWA (HTML + CSS + JS, ~800 regels)
2. `ollama/Caddyfile` — reverse proxy configuratie
3. `ollama/setup.sh` — VPS deploy script

## Wat er gebouwd moet worden

### 1. Caddy routes voor externe providers

Voeg aan `ollama/Caddyfile` deze routes toe:

```caddyfile
ollama.brionize.nl {
    # === Bestaande auth check (BEHOUDEN) ===
    @api_no_key {
        path /api/*
        not {
            header X-API-Key __OLLAMA_API_KEY__
        }
    }
    respond @api_no_key "Ongeautoriseerd" 401

    # === Ollama (bestaand, BEHOUDEN) ===
    handle /api/ollama/* {
        uri strip_prefix /api/ollama
        reverse_proxy localhost:11434 {
            flush_interval -1
            header_up Host localhost:11434
            header_up Origin http://localhost:11434
        }
    }

    # === NIEUW: Claude API ===
    handle /api/claude/* {
        uri strip_prefix /api/claude
        reverse_proxy https://api.anthropic.com {
            header_up x-api-key __CLAUDE_API_KEY__
            header_up anthropic-version 2023-06-01
            header_up Host api.anthropic.com
            flush_interval -1
        }
    }

    # === NIEUW: OpenAI API ===
    handle /api/openai/* {
        uri strip_prefix /api/openai
        reverse_proxy https://api.openai.com {
            header_up Authorization "Bearer __OPENAI_API_KEY__"
            header_up Host api.openai.com
            flush_interval -1
        }
    }

    # === NIEUW: Mistral API ===
    handle /api/mistral/* {
        uri strip_prefix /api/mistral
        reverse_proxy https://api.mistral.ai {
            header_up Authorization "Bearer __MISTRAL_API_KEY__"
            header_up Host api.mistral.ai
            flush_interval -1
        }
    }

    # === Bestaande Ollama fallback voor /api/* (AANPASSEN) ===
    # Oude requests naar /api/chat etc. blijven werken voor backwards compat
    handle /api/* {
        reverse_proxy localhost:11434 {
            flush_interval -1
            header_up Host localhost:11434
            header_up Origin http://localhost:11434
        }
    }

    # === Static files (BEHOUDEN) ===
    handle {
        root * /opt/ollama-pwa/public
        try_files {path} /index.html
        file_server
    }

    # === Security headers (BEHOUDEN) ===
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy no-referrer
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
    }
}
```

**BELANGRIJK**: De `__PLACEHOLDER__` waarden worden door setup.sh vervangen met echte keys via `sed`. Zo staan er nooit keys in de repo.

### 2. Setup script uitbreiden

In `ollama/setup.sh`, voeg na de bestaande API key sectie toe:

```bash
# Extra provider keys (optioneel)
for PROVIDER in CLAUDE OPENAI MISTRAL; do
    KEY_FILE="/etc/caddy/${PROVIDER,,}-api-key"
    PLACEHOLDER="__${PROVIDER}_API_KEY__"
    if [ -f "$KEY_FILE" ]; then
        PROVIDER_KEY=$(cat "$KEY_FILE")
        # Vervang placeholder in caddyfile
        sed -i "s|${PLACEHOLDER}|${PROVIDER_KEY}|g" /etc/caddy/ollama.caddyfile
        echo "${PROVIDER} API key gevonden en ingesteld"
    else
        # Verwijder de route als er geen key is (optionele provider)
        echo "${PROVIDER} API key niet gevonden — route uitgeschakeld"
    fi
done
```

En voeg een hulp-commando toe onderaan:

```bash
echo ""
echo "=== Provider keys instellen (optioneel) ==="
echo "sudo tee /etc/caddy/claude-api-key <<< 'sk-ant-jouw-key'"
echo "sudo tee /etc/caddy/openai-api-key <<< 'sk-jouw-key'"
echo "sudo tee /etc/caddy/mistral-api-key <<< 'jouw-key'"
echo "Na het instellen: sudo bash setup.sh"
```

### 3. PWA frontend aanpassen

#### Provider selector
Voeg een provider-dropdown toe in de header, naast de model-selector:

```html
<select class="provider-select" id="provider-select">
    <option value="ollama">Ollama (lokaal)</option>
    <option value="claude">Claude</option>
    <option value="openai">ChatGPT</option>
    <option value="mistral">Mistral</option>
</select>
```

#### Provider-specifieke logica

Elke provider heeft een ander API formaat. De PWA moet per provider het juiste request sturen:

```javascript
const PROVIDERS = {
    ollama: {
        name: 'Ollama',
        chatPath: '/api/ollama/api/chat',    // of /api/chat voor backwards compat
        modelsPath: '/api/ollama/api/tags',
        parseModels: (data) => (data.models || []).map(m => m.name),
        buildBody: (model, messages, temp) => ({
            model, messages, stream: true,
            options: { temperature: temp }
        }),
        parseStream: 'ollama'  // newline-delimited JSON, message.content
    },
    claude: {
        name: 'Claude',
        chatPath: '/api/claude/v1/messages',
        modelsPath: null,  // Claude heeft geen model-list endpoint
        defaultModels: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250514'],
        buildBody: (model, messages, temp) => {
            // Claude verwacht system apart, niet in messages array
            const system = messages.find(m => m.role === 'system')?.content || '';
            const msgs = messages.filter(m => m.role !== 'system');
            return {
                model, messages: msgs, stream: true,
                max_tokens: 4096, temperature: temp,
                ...(system && { system })
            };
        },
        parseStream: 'claude'  // SSE format, content_block_delta events
    },
    openai: {
        name: 'ChatGPT',
        chatPath: '/api/openai/v1/chat/completions',
        modelsPath: '/api/openai/v1/models',
        parseModels: (data) => (data.data || [])
            .filter(m => m.id.startsWith('gpt-'))
            .map(m => m.id)
            .sort(),
        buildBody: (model, messages, temp) => ({
            model, messages, stream: true, temperature: temp
        }),
        parseStream: 'openai'  // SSE format, choices[0].delta.content
    },
    mistral: {
        name: 'Mistral',
        chatPath: '/api/mistral/v1/chat/completions',
        modelsPath: '/api/mistral/v1/models',
        parseModels: (data) => (data.data || []).map(m => m.id).sort(),
        buildBody: (model, messages, temp) => ({
            model, messages, stream: true, temperature: temp
        }),
        parseStream: 'openai'  // Zelfde SSE format als OpenAI
    }
};
```

#### Stream parsing

Er zijn twee stream formaten:

**Ollama** — newline-delimited JSON:
```
{"message":{"content":"Hallo"},"done":false}
{"message":{"content":" wereld"},"done":false}
{"message":{"content":""},"done":true}
```

**OpenAI/Mistral** — Server-Sent Events (SSE):
```
data: {"choices":[{"delta":{"content":"Hallo"}}]}
data: {"choices":[{"delta":{"content":" wereld"}}]}
data: [DONE]
```

**Claude** — Server-Sent Events (SSE):
```
event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hallo"}}

event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" wereld"}}

event: message_stop
data: {"type":"message_stop"}
```

De `send()` functie moet op basis van de actieve provider het juiste parse-formaat gebruiken.

#### Provider wisselen
Wanneer de gebruiker van provider wisselt:
1. Laad de modellenlijst van die provider (of toon hardcoded defaults voor Claude)
2. Sla de selectie op in localStorage
3. Alle bestaande gesprekken blijven — alleen nieuwe berichten gaan via de nieuwe provider

#### Opslaan per gesprek
Sla per conversatie op welke provider + model er is gebruikt, zodat het in de sidebar zichtbaar is.

## Stijl & design richtlijnen

- **Geen frameworks** — vanilla HTML/CSS/JS, alles in één `index.html`
- **Dark theme** — bestaande kleuren behouden (zie CSS `:root` variabelen)
- **Nederlands** — alle UI tekst in het Nederlands
- **Responsive** — werkt op mobiel (768px breakpoint)
- **Provider kleuren** in de UI (optioneel):
  - Ollama: paars (#6366f1) — huidige accent
  - Claude: oranje (#f97316)
  - ChatGPT: groen (#10b981)
  - Mistral: blauw (#3b82f6)

## Niet doen

- Geen Node.js, geen npm, geen build tools
- Geen externe JavaScript libraries (alles inline)
- Geen API keys in de frontend code of in de repo
- Geen env vars in Caddyfile (werkt niet in matcher blocks, daarom sed)
- De bestaande features (sidebar, presets, export, zoeken) moeten blijven werken
- Geen breaking changes aan de `/api/*` fallback route (backwards compat)

## Testen

Na het bouwen, test:
1. Ollama chat werkt nog steeds (backwards compat)
2. Provider wisselen laadt juiste modellen
3. Streaming werkt voor alle 4 providers
4. Zonder provider key geeft de route een duidelijke foutmelding
5. Gesprekken onthouden welke provider is gebruikt
6. Mobiele layout werkt

## Samenvatting

Het kernidee: **Caddy is de veilige gateway**. De browser kent alleen z'n eigen Caddy-key. Caddy plakt per route de juiste provider-key erop. Keys verlaten nooit de server. De PWA hoeft alleen te weten welk pad het moet aanroepen per provider.
