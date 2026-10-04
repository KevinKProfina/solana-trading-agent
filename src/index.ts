import 'dotenv/config';
import { Keypair, Connection } from '@solana/web3.js';
import bs58 from 'bs58';
import Anthropic from '@anthropic-ai/sdk';
import { solana } from '@agenti/sdk';
import { sendTelegramAlert } from './alerts.js';
import { fetchTrendingTokens } from './market.js';

const mode = process.argv.includes('--mode')
  ? process.argv[process.argv.indexOf('--mode') + 1]
  : process.env.MODE || 'dry-run';

const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';
const autoExecute = process.env.AUTO_EXECUTE === 'true' && !dryRun;
const maxSolPerTrade = Number(process.env.MAX_SOL_PER_TRADE ?? '0.1');
const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? '300000');

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is required');
}

if (!process.env.SOLANA_PRIVATE_KEY) {
  throw new Error('SOLANA_PRIVATE_KEY is required');
}

const connection = new Connection(process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com');
const keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
const trader = solana({ keypair, connection });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getModeLabel() {
  if (dryRun) return 'DRY_RUN';
  if (autoExecute) return 'AUTO';
  return 'MANUAL';
}

function parseDecision(raw: string): 'BUY' | 'SKIP' {
  const cleaned = raw.trim().toUpperCase();
  if (cleaned.startsWith('BUY')) return 'BUY';
  return 'SKIP';
}

async function askClaudeDecision(token: { name: string; mint: string; marketCap: number; volume: number; holders: number }): Promise<'BUY' | 'SKIP'> {
  const prompt = `
You are a careful Solana meme-coin trading assistant.
Your job is to decide whether a token is worth a small, controlled buy.

Token summary:
- Name: ${token.name}
- Mint: ${token.mint}
- Market cap: $${token.marketCap.toLocaleString()}
- 24h volume: $${token.volume.toLocaleString()}
- Holders: ${token.holders.toLocaleString()}

Rules:
- Prefer tokens with real community traction and healthy liquidity.
- Reject obvious pump-and-dumps, fake activity, or suspicious token metadata.
- If the setup looks weak or too risky, answer SKIP.
- If there is a decent signal but still moderate risk, answer SKIP.
- Only answer BUY if the setup is promising and the risk is controlled.

Return ONLY one of these two exact strings:
BUY: <short reason>
SKIP: <short reason>
`;

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 120,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join(' ')
    .trim();

  const decision = parseDecision(text);
  return decision;
}

async function processToken(token: { name: string; mint: string; marketCap: number; volume: number; holders: number }) {
  const decision = await askClaudeDecision(token);

  if (decision === 'BUY') {
    const alertText = `BUY signal: ${token.name} (${token.mint}) | CAP $${token.marketCap.toLocaleString()} | VOL $${token.volume.toLocaleString()} | MODE ${getModeLabel()}`;
    await sendTelegramAlert(alertText);

    if (autoExecute) {
      try {
        const amount = Math.min(maxSolPerTrade, 0.25);
        const result = await trader.buy({
          mint: token.mint,
          solAmount: amount,
          slippage: 10,
        });

        const successText = `Executed BUY for ${token.name} | SOL ${amount} | tx ${result.explorerUrl ?? 'submitted'}`;
        await sendTelegramAlert(successText);
        console.log(successText);
      } catch (error) {
        const errText = `BUY failed for ${token.name}: ${(error as Error).message}`;
        await sendTelegramAlert(errText);
        console.error(errText);
      }
    } else {
      console.log(`DRY_RUN active: ${alertText}`);
    }
  } else {
    console.log(`SKIP ${token.name} (${token.mint})`);
  }
}

async function main() {
  console.log(`Starting Solana trading agent in ${getModeLabel()} mode`);

  const trending = await fetchTrendingTokens();
  console.log(`Fetched ${trending.length} token candidates`);

  for (const token of trending) {
    try {
      await processToken(token);
    } catch (error) {
      console.error(`Token processing failed for ${token.mint}: ${(error as Error).message}`);
    }
  }

  console.log(`Cycle complete. Next poll in ${pollIntervalMs} ms`);
  if (process.env.NODE_ENV !== 'test') {
    setTimeout(main, pollIntervalMs);
  }
}

await main();
