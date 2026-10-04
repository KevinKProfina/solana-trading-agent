export type BacktestCandidate = {
  name: string;
  mint: string;
  marketCap: number;
  volume: number;
  holders: number;
  ageHours?: number;
};

export type BacktestResult = {
  candidates: number;
  accepted: number;
  rejected: number;
  averageSignal: number;
  summary: string;
};

export function runBacktest(candidates: BacktestCandidate[]): BacktestResult {
  const accepted = candidates.filter((candidate) => {
    const score =
      (candidate.marketCap > 500_000 ? 1 : 0) +
      (candidate.volume > 100_000 ? 1 : 0) +
      (candidate.holders > 200 ? 1 : 0) +
      ((candidate.ageHours ?? 0) > 12 ? 1 : 0);

    return score >= 3;
  }).length;

  const rejected = candidates.length - accepted;
  const averageSignal = candidates.length ? accepted / candidates.length : 0;

  return {
    candidates: candidates.length,
    accepted,
    rejected,
    averageSignal,
    summary: `Backtest accepted ${accepted} of ${candidates.length} token candidates with effective signal rate ${averageSignal.toFixed(2)}`,
  };
}
