export type TradeRecord = {
  id: string;
  symbol: string;
  mint: string;
  action: 'BUY' | 'SELL' | 'SKIP';
  solAmount: number;
  entryPrice?: number;
  currentPrice?: number;
  status: 'open' | 'closed' | 'simulated';
  createdAt: string;
  note?: string;
};

export class LedgerStore {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async ensureFile() {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, JSON.stringify([], null, 2), 'utf8');
    }
  }

  async append(record: TradeRecord) {
    await this.ensureFile();
    const fs = await import('node:fs/promises');
    const current = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as TradeRecord[];
    current.push(record);
    await fs.writeFile(this.filePath, JSON.stringify(current, null, 2), 'utf8');
    return record;
  }

  async read() {
    await this.ensureFile();
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(this.filePath, 'utf8');
    try {
      return JSON.parse(content) as TradeRecord[];
    } catch {
      return [] as TradeRecord[];
    }
  }
}
