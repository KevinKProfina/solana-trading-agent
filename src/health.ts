export type HealthSummary = {
  ok: boolean;
  checks: string[];
  warnings: string[];
};

export function evaluateHealth(
  walletBalance: number,
  minRequiredSol: number,
  signalScore: number,
  riskScore: number,
): HealthSummary {
  const checks: string[] = [];
  const warnings: string[] = [];

  const walletOk = walletBalance >= minRequiredSol;
  if (walletOk) {
    checks.push(`wallet balance ok (${walletBalance.toFixed(4)} SOL)`);
  } else {
    warnings.push(`wallet balance too low (${walletBalance.toFixed(4)} SOL < ${minRequiredSol} SOL)`);
  }

  const strategyOk = signalScore >= 70;
  if (strategyOk) {
    checks.push(`strategy score ok (${signalScore})`);
  } else {
    warnings.push(`strategy score weak (${signalScore})`);
  }

  const riskOk = riskScore >= 45;
  if (riskOk) {
    checks.push(`risk gate ok (${riskScore})`);
  } else {
    warnings.push(`risk gate too weak (${riskScore})`);
  }

  return {
    ok: walletOk && strategyOk && riskOk,
    checks,
    warnings,
  };
}
