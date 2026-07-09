# Cod3Uchiha AI WhatsApp Bot

This example uses WAlink and the free Cod3Uchiha Copilot endpoint:

```text
GET https://cod3uchiha.com/ai/copilot?text=YOUR_MESSAGE
```

The endpoint does not require an API key.

## Features

- pairing-code login
- replies to ordinary WhatsApp messages with AI answers
- `!ask`, `!menu`, `!help`, `!ping`, and `!retry` commands
- quick-reply and website buttons
- request queue and retry control
- duplicate-message protection through WAlink
- long-answer splitting
- persistent WhatsApp authentication
- automatic reconnect decisions
- clear API and Cloudflare error messages

## Run

Install dependencies from the WAlink repository root:

```bash
corepack enable
yarn install
```

Copy the environment template:

```bash
cp Example/cod3uchiha-ai-bot.env.example .env
```

Edit `.env` and enter the WhatsApp number that will be paired. Use the international country code without `+`, spaces, or punctuation.

```env
BOT_PHONE_NUMBER=263700000000
```

Start the bot:

```bash
node --env-file=.env --import tsx Example/cod3uchiha-ai-bot.ts
```

Enter the displayed pairing code in WhatsApp under **Linked devices → Link a device → Link with phone number**.

After the connection opens, send any text to the paired WhatsApp account. The bot forwards it to the Cod3Uchiha endpoint and replies with the returned `result`.

## Commands

| Command | Purpose |
| --- | --- |
| `!menu` | Show the interactive menu |
| `!help` | Alias for the menu |
| `!ask question` | Ask the AI directly |
| `!ping` | Check the bot and queue state |
| `!retry` | Retry the previous failed prompt |

## Cloudflare requirement

At the time this example was added, direct server requests to `cod3uchiha.com` received a Cloudflare browser challenge with HTTP `403`. Browsers can complete that challenge, but a server-side WhatsApp bot cannot.

Before deploying the bot, configure Cloudflare so public API routes do not receive an interactive challenge. A suitable setup is:

1. Create an API-specific custom rule for paths beginning with `/ai/`.
2. Skip the challenge-producing security feature for that rule.
3. Keep rate limiting enabled to protect the endpoint from abuse.
4. Alternatively, use an API-only subdomain or direct origin hostname and set it in `.env`:

```env
COD3UCHIHA_AI_ENDPOINT=https://api.cod3uchiha.com/ai/copilot
```

The bot detects Cloudflare challenge pages and returns a useful WhatsApp error instead of attempting to parse HTML as JSON.

## Alternative model

The public API source also provides a GPT-5-labelled endpoint. Switch it without editing the bot:

```env
COD3UCHIHA_AI_ENDPOINT=https://cod3uchiha.com/ai/gpt5
```

## Production notes

- Do not commit the generated authentication directory.
- Keep traffic controlled; the example queue limits concurrent and burst requests.
- Do not use the bot for spam or unsolicited bulk messaging.
- For deployments with multiple instances, replace the local authentication state with a shared persistent session adapter.
