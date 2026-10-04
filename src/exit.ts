export type ExitDecision = {
  shouldSell: boolean;
  reason: string;
  pnlPercent: number;
  targetPrice: number;
  stopLossPrice: number;
};

export function decideExit(
  entryPrice: number,
  currentPrice: number,
  targetProfitPct: number,
  stopLossPct: number,
): ExitDecision {
  const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
  const targetPrice = entryPrice * (1 + targetProfitPct / 100);
  const stopLossPrice = entryPrice * (1 - stopLossPct / 100);

  if (pnlPercent >= targetProfitPct) {
    return {
      shouldSell: true,
      reason: `Profit target reached (${pnlPercent.toFixed(2)}%)`,
      pnlPercent,
      targetPrice,
      stopLossPrice,
    };
  }

  if (pnlPercent <= -stopLossPct) {
    return {
      shouldSell: true,
      reason: `Stop loss reached (${pnlPercent.toFixed(2)}%)`,
      pnlPercent,
      targetPrice,
      stopLossPrice,
    };
  }

  return {
    shouldSell: false,
    reason: `Holding position; current P&L ${pnlPercent.toFixed(2)}%`,
    pnlPercent,
    targetPrice,
    stopLossPrice,
  };
}
