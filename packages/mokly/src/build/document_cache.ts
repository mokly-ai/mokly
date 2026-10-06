/** Byte-bounded least-recently-used values; oversize documents are never retained. */
export class DocumentCache<T> {
  private readonly entries = new Map<string, { value: T; bytes: number }>();
  private bytes = 0;
  constructor(
    private readonly limit: number,
    private readonly size: (value: T) => number,
  ) {}
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }
  set(key: string, value: T): void {
    const old = this.entries.get(key);
    if (old) {
      this.bytes -= old.bytes;
      this.entries.delete(key);
    }
    const bytes = this.size(value);
    if (bytes > this.limit) return;
    this.entries.set(key, { value, bytes });
    this.bytes += bytes;
    while (this.bytes > this.limit) {
      const [first, entry] = this.entries.entries().next().value!;
      this.bytes -= entry.bytes;
      this.entries.delete(first);
    }
  }
  clear(): void {
    this.entries.clear();
    this.bytes = 0;
  }
}
