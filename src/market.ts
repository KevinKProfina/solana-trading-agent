type TrendingToken = {
  name: string;
  mint: string;
  marketCap: number;
  volume: number;
  holders: number;
};

async function fetchTrendingTokens(): Promise<TrendingToken[]> {
  const response = await fetch('https://frontend-api-v3.pump.fun/coins-v2');
  if (!response.ok) {
    throw new Error(`Pool fetch failed: ${response.statusText}`);
  }

  const data = await response.json();
  const tokens = Array.isArray(data) ? data : data?.coins ?? [];

  return tokens
    .filter((item: any) => item?.name && item?.mint)
    .filter((item: any) => Number(item?.market_cap ?? 0) > 100_000)
    .slice(0, 8)
    .map((item: any) => ({
      name: item.name,
      mint: item.mint,
      marketCap: Number(item.market_cap ?? 0),
      volume: Number(item.volume_24h ?? item.volume ?? 0),
      holders: Number(item.holders ?? 0),
    }));
}

export { fetchTrendingTokens, type TrendingToken };
