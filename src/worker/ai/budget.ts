export class AIBudgetManager {
  private kv?: KVNamespace;
  private memoryBudget: Map<string, number> = new Map();

  constructor(kv?: KVNamespace) {
    this.kv = kv;
  }

  private getKey(creatorId: string): string {
    const today = new Date().toISOString().slice(0, 10);
    return `ai_budget:${creatorId}:${today}`;
  }

  async checkBudget(creatorId: string, limitUsd: number = 5.0): Promise<void> {
    const key = this.getKey(creatorId);
    let spent = 0;

    if (this.kv) {
      const val = await this.kv.get(key);
      if (val) {
        spent = parseFloat(val) || 0;
      }
    } else {
      spent = this.memoryBudget.get(key) || 0;
    }

    if (spent >= limitUsd) {
      throw new Error(
        `Daily AI budget limit of $${limitUsd.toFixed(2)} reached for today (Current usage: $${spent.toFixed(3)}). You can adjust your daily budget or switch providers in the Settings tab.`
      );
    }
  }

  async recordUsage(creatorId: string, costUsd: number): Promise<number> {
    const key = this.getKey(creatorId);
    let current = 0;

    if (this.kv) {
      const val = await this.kv.get(key);
      if (val) {
        current = parseFloat(val) || 0;
      }
      const updated = current + costUsd;
      // Expire in 48 hours
      await this.kv.put(key, updated.toFixed(4), { expirationTtl: 172800 });
      return updated;
    } else {
      current = this.memoryBudget.get(key) || 0;
      const updated = current + costUsd;
      this.memoryBudget.set(key, updated);
      return updated;
    }
  }

  async getCurrentUsage(creatorId: string): Promise<number> {
    const key = this.getKey(creatorId);
    if (this.kv) {
      const val = await this.kv.get(key);
      return val ? parseFloat(val) : 0;
    }
    return this.memoryBudget.get(key) || 0;
  }
}
