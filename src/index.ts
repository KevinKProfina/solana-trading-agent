import 'dotenv/config';
import { Keypair, Connection } from '@solana/web3.js';
import bs58 from 'bs58';
import Anthropic from '@anthropic-ai/sdk';
import { solana } from '@agenti/sdk';
import { readConfig, assertConfig } from './config.js';
import { sendTelegramAlert } from './alerts.js';
import { fetchTrendingTokens } from './market.js';
import { scoreToken, shouldBuy } from './strategy.js';
import { assessRisk } from './risk.js';
import { getWalletStatus, ensureWalletHealth } from './wallet.js';
import { evaluateHealth } from './health.js';
import { decideExit } from './exit.js';
import { LedgerStore } from './ledger.js';
import { PaperTradingStore } from './paper.js';

const cfg = readConfig();
assertConfig(cfg);

const connection = new Connection(cfg.solanaRpcUrl);
const keypair = Keypair.fromSecretKey(bs58.decode(cfg.solanaPrivateKey));
const trader = solana({ keypair, connection });
const anthropic = new Anthropic({ apiKey: cfg.anthropicApiKey });
const ledger = new LedgerStore(process.env.LEDGER_PATH ?? '.state/ledger.json');
const paperLedger = new PaperTradingStore(process.env.PAPER_TRADES_PATH ?? '.state/paper-trades.json');

function getModeLabel() {
  return cfg.mode || (cfg.dryRun ? 'DRY_RUN' : cfg.autoExecute ? 'AUTO' : 'MANUAL');
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

async function askClaudeDecision(token: { name: string; mint: string; marketCap: number; volume: number; holders: number; ageHours?: number }) {
  const prompt = `
You are a conservative crypto token scouting assistant.
Only return one exact line:
BUY: <reason>
SKIP: <reason>

Token:
- name: ${token.name}
- mint: ${token.mint}
- market cap: $${formatMoney(token.marketCap)}
- 24h volume: $${formatMoney(token.volume)}
- holders: ${formatMoney(token.holders)}
- ageHours: ${token.ageHours ?? 'unknown'}

Rules:
- Prefer real traction, healthy volume, real holders.
- Reject weak or suspicious microcaps.
- Keep the decision conservative.
- If unclear, choose SKIP.
`;

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 140,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join(' ')
    .trim();

  return text.toUpperCase().startsWith('BUY') ? 'BUY' : 'SKIP';
}

async function processToken(token: { name: string; mint: string; marketCap: number; volume: number; holders: number; ageHours?: number }) {
  const signalScore = scoreToken(token);
  const risk = assessRisk(token);

  if (signalScore < 70 || !risk.allowed) {
    console.log(`SKIP ${token.name} | score=${signalScore} | risk=${risk.score}`);
    return;
  }

  const walletInfo = await getWalletStatus(cfg.solanaPrivateKey, cfg.solanaRpcUrl, Number(process.env.MIN_SOL_BALANCE ?? '0.1'));
  const health = evaluateHealth(walletInfo.solBalance, Number(process.env.MIN_SOL_BALANCE ?? '0.1'), signalScore, risk.score);

  if (!health.ok) {
    console.log(`Health gate failed for ${token.name}: ${health.warnings.join('; ')}`);
    return;
  }

  const decision = await askClaudeDecision(token);
  if (decision !== 'BUY') {
    console.log(`Claude skipped ${token.name}`);
    return;
  }

  const alertText = `BUY signal: ${token.name} (${token.mint}) | score=${signalScore} | risk=${risk.score} | vol=$${formatMoney(token.volume)} | cap=$${formatMoney(token.marketCap)} | mode=${getModeLabel()}`;
  await sendTelegramAlert(alertText);

  if (cfg.mode === 'paper') {
    await paperLedger.add({
      id: crypto.randomUUID(),
      symbol: token.name,
      mint: token.mint,
      solAmount: Number(Math.min(cfg.maxSolPerTrade, 0.05).toFixed(4)),
      status: 'paper-buy',
      createdAt: new Date().toISOString(),
      notes: `Paper buy simulated; signal=${signalScore}; risk=${risk.score}`,
    });
    console.log(`PAPER BUY recorded for ${token.name} (${token.mint})`);
    return;
  }

  if (cfg.dryRun || cfg.mode === 'dry-run') {
    console.log(`DRY_RUN approved: ${alertText}`);
    await ledger.append({
      id: crypto.randomUUID(),
      symbol: token.name,
      mint: token.mint,
      action: 'BUY',
      solAmount: Number(Math.min(cfg.maxSolPerTrade, 0.1).toFixed(4)),
      status: 'simulated',
      createdAt: new Date().toISOString(),
      note: 'dry-run simulation',
    });
    return;
  }

  try {
    await ensureWalletHealth(cfg.solanaPrivateKey, cfg.solanaRpcUrl, Number(process.env.MIN_SOL_BALANCE ?? '0.1'));
    const size = Math.min(cfg.maxSolPerTrade, 0.25);
    const result = await trader.buy({
      mint: token.mint,
      solAmount: size,
      slippage: 10,
    });

    const successText = `Executed BUY for ${token.name} | size=${size} SOL | tx=${result.explorerUrl ?? 'submitted'}`;
    await ledger.append({
      id: crypto.randomUUID(),
      symbol: token.name,
      mint: token.mint,
      action: 'BUY',
      solAmount: size,
      status: 'open',
      createdAt: new Date().toISOString(),
      note: `Executed in ${cfg.mode} mode`,
    });
    await sendTelegramAlert(successText);
    console.log(successText);
  } catch (error) {
    const err = `Trade failed for ${token.name}: ${(error as Error).message}`;
    await sendTelegramAlert(err);
    console.error(err);
  }
}

async function runCycle() {
  const walletInfo = await getWalletStatus(cfg.solanaPrivateKey, cfg.solanaRpcUrl, Number(process.env.MIN_SOL_BALANCE ?? '0.1'));
  console.log(`Wallet status: ${walletInfo.message}`);

  const tokens = await fetchTrendingTokens();
  console.log(`Fetched ${tokens.length} candidates`);

  for (const token of tokens) {
    try {
      const shouldTake = shouldBuy(token) && assessRisk(token).allowed;
      if (!shouldTake) {
        console.log(`Pre-filter skipped ${token.name}`);
        continue;
      }

      await processToken(token);
    } catch (error) {
      console.error(`Token processing failed for ${token.name}: ${(error as Error).message}`);
    }
  }

  const exitPrice = 1.1;
  const entryPrice = 1;
  const exitDecision = decideExit(entryPrice, exitPrice, Number(process.env.TARGET_PROFIT_PCT ?? '12'), Number(process.env.STOP_LOSS_PCT ?? '8'));
  console.log(`Exit check: ${exitDecision.reason}`);
  console.log(`Next poll in ${cfg.pollIntervalMs} ms`);
  setTimeout(runCycle, cfg.pollIntervalMs);
}

await runCycle();
