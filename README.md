# Solana Trading Agent

This project is a lightweight autonomous trading agent for pump.fun-style token opportunities on Solana.

It will:
- discover trending tokens,
- ask Claude for a buy/skip decision,
- execute a controlled trade via `@agenti/sdk`,
- send Telegram alerts,
- run in safe `DRY_RUN` mode by default.

## Quick start

1. Copy `.env.example` to `.env` and fill in your keys.
2. Install dependencies:

```bash
npm install
```

3. Run in dry-run mode first:

```bash
npm run dry-run
```

4. When you are comfortable, switch to mainnet execution:

```bash
AUTO_EXECUTE=true
DRY_RUN=false
npm run mainnet
```

## Safety

- Default behavior is `DRY_RUN=true`.
- `MAX_SOL_PER_TRADE` limits trade size.
- The bot intentionally filters out suspicious tokens and uses strict model prompts.
- This is experimental software for learning and controlled testing only.

## Required env variables

- `ANTHROPIC_API_KEY`
- `SOLANA_PRIVATE_KEY` in base58 format
- `SOLANA_RPC_URL`
- `AUTO_EXECUTE` (`true|false`)
- `DRY_RUN` (`true|false`)
- `MAX_SOL_PER_TRADE`
- `POLL_INTERVAL_MS`
- `TELEGRAM_BOT_TOKEN` (optional)
- `TELEGRAM_CHAT_ID` (optional)

## Notes

This is a starting point for a real autonomous trading agent. It is intentionally conservative and designed to be upgraded toward more advanced strategies.
