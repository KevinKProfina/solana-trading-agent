export type PortfolioConfig = {
  totalCapital: number;
  maxExposureRatio: number;
  maxPositionWeight: number;
  maxConcurrentPositions: number;
};

export type PortfolioState = {
  capital: number;
  exposure: number;
  positions: number;
  allocations: Record<string, number>;
};

export class PortfolioManager {
  private config: PortfolioConfig;
  private state: PortfolioState;

  constructor(config: PortfolioConfig) {
    this.config = config;
    this.state = {
      capital: config.totalCapital,
      exposure: 0,
      positions: 0,
      allocations: {},
    };
  }

  updateAllocation(symbol: string, weight: number) {
    this.state.allocations[symbol] = weight;
  }

  setExposure(exposure: number) {
    this.state.exposure = exposure;
  }

  setPositions(count: number) {
    this.state.positions = count;
  }

  canTrade(symbol: string, candidateWeight: number) {
    const existingWeight = this.state.allocations[symbol] ?? 0;
    const nextWeight = existingWeight + candidateWeight;

    const maxWeightViolation = nextWeight > this.config.maxPositionWeight;
    const maxExposureViolation = this.state.exposure > this.config.totalCapital * this.config.maxExposureRatio;
    const tooManyPositions = this.state.positions >= this.config.maxConcurrentPositions;

    return !(maxWeightViolation || maxExposureViolation || tooManyPositions);
  }

  snapshot(): PortfolioState {
    return { ...this.state, allocations: { ...this.state.allocations } };
  }
}
