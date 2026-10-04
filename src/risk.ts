export type RiskResult = {
  score: number;
  allowed: boolean;
  reason: string;
};

export type RiskToken = {
  name: string;
  mint: string;
  marketCap: number;
  volume: number;
  holders: number;
  ageHours?: number;
};

export function assessRisk(token: RiskToken): RiskResult {
  let score = 0;

  if (token.marketCap >= 500_000) score += 20;
  if (token.marketCap >= 2_000_000) score += 20;
  if (token.marketCap >= 10_000_000) score += 15;

  if (token.volume >= 100_000) score += 20;
  if (token.volume >= 500_000) score += 20;
  if (token.volume >= 2_000_000) score += 15;

  if (token.holders >= 200) score += 10;
  if (token.holders >= 1000) score += 10;

  if (token.ageHours && token.ageHours > 12) score += 10;
  if (token.ageHours && token.ageHours > 48) score += 10;

  // Constrain edge cases
  if (token.volume <= 20_000) score -= 30;
  if (token.marketCap <= 40_000) score -= 30;
  if (token.holders <= 50) score -= 20;

  const allowed = score >= 45;
  const reason = allowed
    ? `risk acceptable (${score}) – moderate traction and liquidity`
    : `risk too weak (${score}) – insufficient traction or liquidity`;

  return { score, allowed, reason };
}
