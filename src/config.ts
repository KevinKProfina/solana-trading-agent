export type AppConfig = {
  anthropicApiKey: string;
  solanaPrivateKey: string;
  solanaRpcUrl: string;
  dryRun: boolean;
  autoExecute: boolean;
  maxSolPerTrade: number;
  pollIntervalMs: number;
  minMarketCap: number;
  telegramBotToken?: string;
  telegramChatId?: string;
  mode: 'dry-run' | 'mainnet' | 'testnet';
};

export function readConfig(): AppConfig {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? '';
  const solanaPrivateKey = process.env.SOLANA_PRIVATE_KEY ?? '';
  const solanaRpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
  const dryRun = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');
  const autoExecute = process.env.AUTO_EXECUTE === 'true' && !dryRun;
  const modeFlag = process.argv.includes('--mode') ? process.argv[process.argv.indexOf('--mode') + 1] : process.env.MODE;
  const mode = (modeFlag === 'mainnet' || modeFlag === 'testnet' || modeFlag === 'dry-run') ? modeFlag : dryRun ? 'dry-run' : 'mainnet';

  return {
    anthropicApiKey,
    solanaPrivateKey,
    solanaRpcUrl,
    dryRun,
    autoExecute,
    maxSolPerTrade: Number(process.env.MAX_SOL_PER_TRADE ?? '0.1'),
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? '300000'),
    minMarketCap: Number(process.env.MIN_MARKET_CAP ?? '100000'),
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || undefined,
    telegramChatId: process.env.TELEGRAM_CHAT_ID || undefined,
    mode,
  };
}

export function assertConfig(cfg: AppConfig) {
  if (!cfg.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }

  if (!cfg.solanaPrivateKey) {
    throw new Error('SOLANA_PRIVATE_KEY is required');
  }

  if (!Number.isFinite(cfg.maxSolPerTrade) || cfg.maxSolPerTrade <= 0) {
    throw new Error('MAX_SOL_PER_TRADE must be positive');
  }
}
