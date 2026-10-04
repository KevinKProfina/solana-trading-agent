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

const cfg = readConfig();
assertConfig(cfg);

const connection = new Connection(cfg.solanaRpcUrl);
const keypair = Keypair.fromSecretKey(bs58.decode(cfg.solanaPrivateKey));
const trader = solana({ keypair, connection });
const anthropic = new Anthropic({ apiKey: cfg.anthropicApiKey });

function getModeLabel() {
  return cfg.dryRun ? 'DRY_RUN' : cfg.autoExecute ? 'AUTO' : 'MANUAL';
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

async function askClaudeDecision(token: {
  name: string;
  mint: string;
  marketCap: number;
  volume: number;
  holders: number;
  ageHours?: number;
}) {
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
- Prioritize signals with healthy volume and real holders.
- Reject suspicious, microcap, or fake-liquidity tokens.
- Keep the decision conservative.
- A weak or unclear setup should be SKIP.
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

  const upper = text.toUpperCase();
  if (upper.startsWith('BUY')) return 'BUY';
  return 'SKIP';
}

async function processToken(token: {
  name: string;
  mint: string;
  marketCap: number;
  volume: number;
  holders: number;
  ageHours?: number;
}) {
  const signalScore = scoreToken(token);
  const risk = assessRisk(token);

  if (signalScore < 70 || !risk.allowed) {
    console.log(`SKIP ${token.name} | score=${signalScore} | risk=${risk.score} | reason=${risk.reason}`);
    return;
  }

  const decision = await askClaudeDecision(token);
  if (decision !== 'BUY') {
    console.log(`Claude skipped ${token.name} (${token.mint}) | signal=${signalScore}`);
    return;
  }

  const alertText = `BUY signal: ${token.name} (${token.mint}) | score=${signalScore} | risk=${risk.score} | vol=$${formatMoney(token.volume)} | cap=$${formatMoney(token.marketCap)} | mode=${getModeLabel()}`;
  await sendTelegramAlert(alertText);

  if (!cfg.autoExecute) {
    console.log(`DRY_RUN approved: ${alertText}`);
    return;
  }

  try {
    const size = Math.min(cfg.maxSolPerTrade, 0.25);
    const result = await trader.buy({
      mint: token.mint,
      solAmount: size,
      slippage: 10,
    });

    const successText = `Bought ${token.name} | size=${size} SOL | tx=${result.explorerUrl ?? 'submitted'}`;
    await sendTelegramAlert(successText);
    console.log(successText);
  } catch (error) {
    const err = `Trade failed for ${token.name}: ${(error as Error).message}`;
    await sendTelegramAlert(err);
    console.error(err);
  }
}

async function main() {
  console.log(`Starting Solana trading agent | mode=${getModeLabel()} | dryRun=${cfg.dryRun} | autoExecute=${cfg.autoExecute}`);

  const tokens = await fetchTrendingTokens();
  console.log(`Fetched ${tokens.length} candidates`);

  for (const token of tokens) {
    try {
      const shouldTake = shouldBuy(token) && assessRisk(token).allowed;
      if (!shouldTake) {
        console.log(`Pre-filter skipped ${token.name} | marketCap=${token.marketCap} | volume=${token.volume}`);
        continue;
      }

      await processToken(token);
    } catch (error) {
      console.error(`Token processing failed for ${token.name}: ${(error as Error).message}`);
    }
  }

  console.log(`Cycle complete -> sleeping ${cfg.pollIntervalMs} ms`);
  setTimeout(main, cfg.pollIntervalMs);
}

await main();
