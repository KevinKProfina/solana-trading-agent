export type TokenSignal = {
  name: string;
  mint: string;
  marketCap: number;
  volume: number;
  holders: number;
  ageHours?: number;
};

export function scoreToken(token: TokenSignal): number {
  let score = 0;

  if (token.marketCap > 500_000) score += 25;
  if (token.marketCap > 2_000_000) score += 20;
  if (token.marketCap > 10_000_000) score += 20;

  if (token.volume > 100_000) score += 25;
  if (token.volume > 500_000) score += 20;
  if (token.volume > 2_000_000) score += 15;

  if (token.holders > 200) score += 15;
  if (token.holders > 500) score += 10;
  if (token.holders > 2000) score += 10;

  if (token.ageHours && token.ageHours > 12) score += 10;
  if (token.ageHours && token.ageHours > 48) score += 5;

  return score;
}

export function shouldBuy(token: TokenSignal): boolean {
  return scoreToken(token) >= 70;
}
