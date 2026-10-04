import type { StrategyRules } from './config.js';
import type { Token } from './market.js';

export type Evaluation = {
  allowed: boolean;
  score: number;
  /** Gate failures (when rejected) or score notes. */
  reasons: string[];
};

/** Hard risk gates. Any failure rejects the token regardless of score. */
export function riskGates(token: Token, rules: StrategyRules): string[] {
  const failures: string[] = [];
  const txns = token.buys24h + token.sells24h;
  if (!(token.priceUsd > 0)) failures.push('no price');
  if (token.liquidityUsd < rules.minLiquidityUsd) failures.push(`liquidity $${Math.round(token.liquidityUsd)} < $${rules.minLiquidityUsd}`);
  if (token.volume24hUsd < rules.minVolume24hUsd) failures.push(`24h volume $${Math.round(token.volume24hUsd)} < $${rules.minVolume24hUsd}`);
  if (token.marketCapUsd < rules.minMarketCapUsd) failures.push(`market cap $${Math.round(token.marketCapUsd)} < $${rules.minMarketCapUsd}`);
  if (token.marketCapUsd > rules.maxMarketCapUsd) failures.push(`market cap $${Math.round(token.marketCapUsd)} > $${rules.maxMarketCapUsd}`);
  if (!Number.isFinite(token.ageHours)) failures.push('unknown pair age');
  else if (token.ageHours < rules.minAgeHours) failures.push(`pair age ${token.ageHours.toFixed(1)}h < ${rules.minAgeHours}h`);
  if (txns < rules.minTxns24h) failures.push(`24h txns ${txns} < ${rules.minTxns24h}`);
  const ratio = token.sells24h > 0 ? token.buys24h / token.sells24h : token.buys24h > 0 ? Infinity : 0;
  if (ratio < rules.minBuySellRatio) failures.push(`buy/sell ratio ${ratio.toFixed(2)} < ${rules.minBuySellRatio}`);
  if (token.marketCapUsd > 0 && token.liquidityUsd / token.marketCapUsd < rules.minLiquidityToMcap) {
    failures.push(`liquidity/mcap ${(token.liquidityUsd / token.marketCapUsd).toFixed(3)} < ${rules.minLiquidityToMcap}`);
  }
  return failures;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Log-scaled 0..1 between lo and hi. */
const logScale = (x: number, lo: number, hi: number) => (x <= lo ? 0 : clamp01(Math.log10(x / lo) / Math.log10(hi / lo)));

/** Deterministic 0..100 score. Higher = deeper, more active, more seasoned market with buy pressure. */
export function scoreToken(token: Token): number {
  const liquidity = logScale(token.liquidityUsd, 20_000, 2_000_000) * 25;
  const volume = logScale(token.volume24hUsd, 50_000, 10_000_000) * 25;
  const buyShare = token.buys24h + token.sells24h > 0 ? token.buys24h / (token.buys24h + token.sells24h) : 0;
  // 45 % buys → 0, 65 % buys → full marks
  const pressure = clamp01((buyShare - 0.45) / 0.2) * 20;
  const age = Number.isFinite(token.ageHours) ? logScale(token.ageHours, 6, 24 * 30) * 15 : 0;
  // turnover (volume/liquidity) between 0.5x and 5x is healthy; extremes score lower
  const turnover = token.liquidityUsd > 0 ? token.volume24hUsd / token.liquidityUsd : 0;
  const turnoverScore = turnover < 0.5 ? turnover / 0.5 : turnover <= 5 ? 1 : clamp01(1 - (turnover - 5) / 20);
  return Math.round(liquidity + volume + pressure + age + turnoverScore * 15);
}

export function evaluateToken(token: Token, rules: StrategyRules): Evaluation {
  const failures = riskGates(token, rules);
  const score = scoreToken(token);
  if (failures.length > 0) return { allowed: false, score, reasons: failures };
  if (score < rules.minScore) return { allowed: false, score, reasons: [`score ${score} < ${rules.minScore}`] };
  return { allowed: true, score, reasons: [`score ${score}`] };
}

/** Evaluate and rank candidates (best score first). */
export function rankCandidates(tokens: Token[], rules: StrategyRules): Array<{ token: Token; evaluation: Evaluation }> {
  return tokens
    .map((token) => ({ token, evaluation: evaluateToken(token, rules) }))
    .sort((a, b) => b.evaluation.score - a.evaluation.score);
}
