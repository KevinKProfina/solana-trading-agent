# solana-trading-agent

Strategy `solana-trader` (kind `trading`) for the Money Machine system. It scans newly listed Solana
tokens on DexScreener, filters them with deterministic risk gates and a score, optionally asks Claude
for a final yes/no, and manages a small book of long positions with take-profit, stop-loss, trailing
stop and max-holding-time exits.

**By default it trades on paper.** Paper fills are simulated; no transaction is sent and no real
profit or loss happens. Nothing in this repository is a promise of returns. Memecoin-style tokens are
extremely risky and most lose value.

## What it does

Each cycle:

1. **Manage open positions**: fetch current prices from DexScreener, track the highest price
   seen, and close positions on take-profit, stop-loss, trailing stop (armed after a minimum gain)
   or max holding time. Exits still run when the kill switch is on or the strategy is paused.
2. **Discover candidates**: `GET https://api.dexscreener.com/token-profiles/latest/v1` (Solana
   only), then `GET https://api.dexscreener.com/latest/dex/tokens/{mints}`. For each mint it uses the
   pair with the deepest liquidity, normalized to price, liquidity, 24h volume, market cap, pair
   age and 24h buys/sells.
3. **Gate and score** (`src/strategy.ts`): hard rejects for low liquidity, low volume, market cap
   outside range, pair too new or of unknown age, too few transactions, sell pressure (buy/sell ratio),
   and thin liquidity relative to market cap. Survivors get a 0–100 score, and must reach `MIN_SCORE`.
4. **Optional Claude gate** (`src/claude-gate.ts`): only when `ANTHROPIC_API_KEY` is set. It runs on
   tokens that already passed the deterministic rules. Claude must answer with one line,
   `BUY: …` or `SKIP: …`. A refusal, an error or an unclear answer counts as SKIP.
5. **Size and open** (`src/sizing.ts`): size = `min(MAX_USD_PER_TRADE, budget × MAX_POSITION_PCT,
   budget − deployed)`. It never holds two positions in the same mint, respects
   `MAX_CONCURRENT_POSITIONS`, and skips a mint for 24h after closing it.
6. **Report**: computes realized and unrealized PnL, win rate, average profit, max drawdown (from an
   equity curve kept in state) and a per-trade Sharpe ratio. It writes the `StrategyReport` and
   appends `position.opened` / `position.closed` events. A Telegram alert is optional.

## How it fits into the system

| reads | writes |
|---|---|
| `$MM_STATE_DIR/allocations.json` (budget, paused), `$MM_STATE_DIR/KILL` / `MM_KILL=1` | `$MM_STATE_DIR/strategies/solana-trader.json` (`mm.strategy-report/v1`), `$MM_STATE_DIR/events.jsonl` |

Own state is kept in `$MM_STATE_DIR/solana-trader/positions.json` (paper) and
`positions.live.json` (live). Paper and live positions are never mixed. Each file holds open and
closed positions, the equity curve and the running max drawdown.

- Until the orchestrator has written `allocations.json`, the budget is `STARTING_CAPITAL_USD`.
- `totalReturn` = (realized + unrealized) / `STARTING_CAPITAL_USD`.
- `capitalUsd` is the current budget, and `deployedUsd` is the cost basis of open positions.
- `src/mm-contract.ts` is a verbatim copy of `money-machine-core/contract/mm-contract.ts`. Do not edit it here.

The supervisor runs `npm run once`.

## Setup

```bash
npm install
cp .env.example .env   # optional — everything has safe defaults
npm run check && npm test
MM_STATE_DIR=$(mktemp -d) npm run once
```

Requires Node 22+.

## Environment variables

See `.env.example` for the full list with defaults. The most important ones:

| var | default | meaning |
|---|---|---|
| `MM_STATE_DIR` | `./.mm-state` | shared Money Machine state dir |
| `MODE` | `paper` | `paper`, `dry-run` or `live` |
| `LIVE_TRADING_CONFIRM` | – | must equal `I_UNDERSTAND_REAL_MONEY_RISK` for live |
| `STARTING_CAPITAL_USD` | 1000 | budget before allocations exist; denominator of totalReturn |
| `MAX_USD_PER_TRADE` / `MAX_POSITION_PCT` / `MAX_CONCURRENT_POSITIONS` | 50 / 0.1 / 5 | sizing caps |
| `MIN_LIQUIDITY_USD`, `MIN_VOLUME_24H_USD`, `MIN_MARKET_CAP_USD`, `MIN_AGE_HOURS`, `MIN_BUY_SELL_RATIO`, `MIN_SCORE` … | see `.env.example` | entry gates |
| `TAKE_PROFIT_PCT` / `STOP_LOSS_PCT` / `TRAILING_STOP_PCT` / `TRAILING_ACTIVATION_PCT` / `MAX_HOLD_HOURS` | 25 / 10 / 8 / 5 / 48 | exits |
| `KILL_CLOSES_POSITIONS` | false | close everything while the kill switch is active |
| `PAPER_SLIPPAGE_BPS` / `PAPER_FEE_BPS` | 100 / 30 | paper fill model |
| `ANTHROPIC_API_KEY`, `USE_CLAUDE_GATE` | – / true | optional Claude gate (`claude-opus-5-5`) |
| `SOLANA_PRIVATE_KEY`, `SOLANA_RPC_URL`, `LIVE_SLIPPAGE_BPS`, `MIN_SOL_BALANCE` | – | live only |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | – | optional alerts (otherwise logged) |
| `POLL_INTERVAL_MS` | 300000 | loop interval |

## Run modes

| command | what it does |
|---|---|
| `npm run once` | one cycle, then exit (exit code 0 on success, 1 on a fatal error) |
| `npm start` / `npm run dev` | loop every `POLL_INTERVAL_MS` (`dev` restarts on file changes) |
| `npm run dry-run` | one cycle that only evaluates candidates and logs "would open". No positions are stored. |
| `npm run replay [-- file.json]` | replays price series (default `fixtures/replay-series.json`, **synthetic**) through the real exit rules and paper fill model |
| `npm run wallet-check` | read-only: prints the wallet public key and SOL balance |
| `npm run check` / `npm test` | type-check and run the tests (node:test, fixtures only, no network) |

Modes:

- **paper** (default): fills at the current DexScreener price, adjusted for slippage, liquidity-based price impact and a fee. Every
  position is stored with `simulated: true`, and every log, event and alert line is prefixed `[SIMULATED]`.
- **dry-run**: evaluation only. It writes the report, which has no positions.
- **live**: real swaps through Jupiter. Live mode requires all of the following:
  - `MODE=live`
  - `LIVE_TRADING_CONFIRM=I_UNDERSTAND_REAL_MONEY_RISK`
  - `SOLANA_PRIVATE_KEY` set (as base58 or a JSON byte array)

  If `MODE=live` is set without the confirmation phrase, the agent falls back to paper and says so.
  If the phrase is set but the key is missing, it exits with an error.

## Safety

- Safe default: paper mode. A missing `ANTHROPIC_API_KEY`, `SOLANA_PRIVATE_KEY` or Telegram setting
  never breaks a paper or dry-run cycle.
- No new positions while the kill switch is on (`KILL` file or `MM_KILL=1`), while the orchestrator
  has paused the strategy, or when there is no budget. Open positions keep being managed and can be
  exited. They are only force-closed when `KILL_CLOSES_POSITIONS=true`.
- Total deployed capital is kept within the orchestrator budget, and the number of concurrent positions is capped.
- External calls (DexScreener, Jupiter, Telegram, Anthropic) use timeouts. Read calls retry with
  exponential backoff, and failures become empty results plus a note in the report.
- The secret key is decoded only in live mode or by `wallet-check`, and it is never logged.
- Live mode checks the SOL balance (`MIN_SOL_BALANCE` reserve) before opening positions.

## Status / limitations

- **The live Jupiter executor (`src/jupiter.ts`) is UNTESTED ON MAINNET.** It has only been
  type-checked. It has never executed a real swap. It does the following:
  - quotes and swaps via `lite-api.jup.ag/swap/v1`
  - signs a `VersionedTransaction` locally
  - sends and confirms the transaction
  - measures received tokens and SOL from balance deltas

  It has no retry for a failed send, no Jito/MEV protection, and no recovery if a transaction lands but
  confirmation times out. If you enable it, use tiny sizes and verify every transaction yourself.
- Paper results are simulated. The fill model (last DexScreener price, fixed slippage and fee, plus a
  constant-product price-impact estimate from pool liquidity) ignores MEV, latency and price moves
  between quote and fill, so real fills would likely be worse.
- Unrealized PnL is marked at the DexScreener price, before exit costs.
- DexScreener `token-profiles/latest` lists tokens that bought a profile. That is a discovery feed,
  not a quality signal. Rate limits apply (about 60 profile requests and 300 pair requests per minute).
- If a held token has no price on DexScreener, its exit check is skipped for that cycle. No price is invented.
- The replay only exercises the exit rules on the bundled **synthetic** series. Entry selection
  cannot be backtested, because DexScreener offers no historical snapshots.
- Known `npm audit` findings: moderate advisories in `@solana/web3.js@1` transitive dependencies
  (`jayson` → `stream-json`, `uuid`). The fix requires the breaking `@solana/web3.js@3` migration.
