import fs from 'node:fs/promises';
import path from 'node:path';

export type PaperTradeRecord = {
  id: string;
  symbol: string;
  mint: string;
  solAmount: number;
  status: 'paper-buy' | 'paper-sell' | 'paper-skip';
  createdAt: string;
  notes: string;
};

export class PaperTradingStore {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async ensureFile() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, JSON.stringify([], null, 2), 'utf8');
    }
  }

  async add(trade: PaperTradeRecord) {
    await this.ensureFile();
    const existing = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as PaperTradeRecord[];
    existing.push(trade);
    await fs.writeFile(this.filePath, JSON.stringify(existing, null, 2), 'utf8');
    return trade;
  }

  async read() {
    await this.ensureFile();
    const content = await fs.readFile(this.filePath, 'utf8');
    try {
      return JSON.parse(content) as PaperTradeRecord[];
    } catch {
      return [] as PaperTradeRecord[];
    }
  }
}
