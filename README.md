# Solana Trading Agent

A scalable autonomous trading foundation for Solana token discovery, decisioning, and execution.

## What this version includes

- Solana wallet integration through `@agenti/sdk`
- Trend market scanning for Pump.fun-like opportunities
- Risk assessment before any buy
- Claude-driven buy/skip decisions
- Telegram alerts
- Dry-run safety by default
- Production-friendly config separation
- Strategy scoring architecture ready for expansion

## Philosophy

This is not a gambling script. It is a disciplined starting point for a production system that can later evolve toward:

- multi-strategy execution,
- backtesting,
- portfolio risk systems,
- rebalancing,
- on-chain position tracking,
- agent-to-agent settlement,
- and a full autonomous economic layer.

## Quick start

1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies:

```bash
npm install
```

3. Run in dry-run mode:

```bash
npm run dry-run
```

4. When ready for execution:

```bash
AUTO_EXECUTE=true
DRY_RUN=false
npm run mainnet
```

## System architecture

The current design is intentionally modular so it can grow into a full trading system:

- `src/config.ts` — environment-based configuration
- `src/market.ts` — market discovery and token collection
- `src/strategy.ts` — scoring and decision thresholds
- `src/risk.ts` — risk gatekeeping
- `src/alerts.ts` — Telegram notifications
- `src/index.ts` — orchestration loop

## Safety framework

The system is built around a strict safety model:

- no trade can happen without a risk gate,
- no trade can happen without a strategy score threshold,
- `DRY_RUN` is the default path,
- `AUTO_EXECUTE` is explicitly opt-in,
- max trade size is limited by environment configuration,
- alerts provide operational transparency.

## Next-stage roadmap

This foundation is already designed for the next layers of the bigger vision:

1. Paper trading / backtest mode
2. Multi-strategy allocation system
3. Portfolio-level risk tracking
4. Lifecycle management of positions
5. Agent marketplace and autonomous task payments
6. Production-grade monitoring and reliability controls

## Long-term plan

The real win is not just another trading bot. The bigger goal is to build an autonomous economic layer where agents can:

- discover opportunities,
- evaluate risk,
- execute trades,
- pay for resources,
- allocate capital across strategies,
- and self-expand through earned capital and better execution.

This repo is the first controlled foundation for that larger trajectory.
