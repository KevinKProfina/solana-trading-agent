export type TrendingToken = {
  name: string;
  mint: string;
  marketCap: number;
  volume: number;
  holders: number;
  ageHours?: number;
};

function normalizeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

async function fetchTrendingTokens(): Promise<TrendingToken[]> {
  try {
    const response = await fetch('https://frontend-api-v3.pump.fun/coins-v2');
    if (!response.ok) {
      throw new Error(`Pool fetch failed: ${response.statusText}`);
    }

    const data = await response.json();
    const tokens = Array.isArray(data) ? data : data?.coins ?? [];

    return tokens
      .filter((item: any) => item?.name && item?.mint)
      .map((item: any) => ({
        name: item.name,
        mint: item.mint,
        marketCap: normalizeNumber(item.market_cap ?? item.marketCap ?? 0),
        volume: normalizeNumber(item.volume_24h ?? item.volume ?? 0),
        holders: normalizeNumber(item.holders ?? 0),
        ageHours: normalizeNumber(item.age_hours ?? item.ageHours ?? 0),
      }))
      .filter((item) => item.marketCap > 100_000)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 12);
  } catch (error) {
    console.error(`Market fetch failed: ${(error as Error).message}`);
    return [];
  }
}

export { fetchTrendingTokens, type TrendingToken };
