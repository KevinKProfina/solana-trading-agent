export type PositionStatus = 'open' | 'closed';

export type Position = {
  mint: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  quantity: number;
  notional: number;
  openedAt: string;
  status: PositionStatus;
};

export class PositionManager {
  private positions: Map<string, Position> = new Map();

  openPosition(mint: string, symbol: string, side: 'long' | 'short', entryPrice: number, quantity: number) {
    const notional = Math.abs(entryPrice * quantity);
    const position: Position = {
      mint,
      symbol,
      side,
      entryPrice,
      quantity,
      notional,
      openedAt: new Date().toISOString(),
      status: 'open',
    };

    this.positions.set(`${mint}:${symbol}:${side}`, position);
    return position;
  }

  closePosition(mint: string, symbol: string, side: 'long' | 'short') {
    const key = `${mint}:${symbol}:${side}`;
    const position = this.positions.get(key);

    if (!position) {
      return null;
    }

    const closed: Position = { ...position, status: 'closed' };
    this.positions.set(key, closed);
    return closed;
  }

  getOpenPositions() {
    return [...this.positions.values()].filter((position) => position.status === 'open');
  }

  getTotalExposure() {
    return this.getOpenPositions().reduce((sum, position) => sum + position.notional, 0);
  }
}
