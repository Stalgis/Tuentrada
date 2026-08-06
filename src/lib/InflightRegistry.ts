export class InflightRegistry<T> {
  private readonly entries = new Map<string, Promise<T>>();

  getOrCreate(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.entries.get(key);
    if (existing) return existing;

    let promise: Promise<T>;
    promise = factory().finally(() => {
      if (this.entries.get(key) === promise) {
        this.entries.delete(key);
      }
    });
    this.entries.set(key, promise);
    return promise;
  }

  clear(): void {
    this.entries.clear();
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }
}
