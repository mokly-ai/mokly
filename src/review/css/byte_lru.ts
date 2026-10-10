/** Immutable, detached entries bounded by the protocol's estimated byte cost. */
export interface DetachedCacheValue<Value> {
  value: Value;
  ruleCount: number;
  stringUnits: number;
}

export const CSS_CACHE_BYTES = 64 * 1024 * 1024;

/** Copy UTF-16 code units through independent bytes, including lone surrogates. */
export function flatString(text: string): string {
  return Buffer.from(text, "utf16le").toString("utf16le");
}

/** A classification-local LRU; a miss or an uncacheable value changes time only. */
export class ByteBoundedLru<Value> {
  private readonly entries = new Map<
    string,
    { key: string; value: Value; bytes: number }
  >();
  private bytes = 0;

  constructor(
    private readonly detach: (
      value: Value,
    ) => DetachedCacheValue<Value> | undefined,
    private readonly limit = CSS_CACHE_BYTES,
  ) {
    if (!Number.isSafeInteger(limit) || limit < 0)
      throw new RangeError(
        "CSS cache byte bound must be a non-negative integer",
      );
  }

  get estimatedBytes(): number {
    return this.bytes;
  }

  get size(): number {
    return this.entries.size;
  }

  get(key: string): Value | undefined {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    this.entries.set(entry.key, entry);
    return entry.value;
  }

  /** Return the retained copy, or the original value when it cannot be retained. */
  set(key: string, value: Value): Value {
    if (!this.limit) return value;
    const detached = this.detach(value);
    if (!detached) return value;
    const bytes =
      64 + 96 * detached.ruleCount + 2 * (key.length + detached.stringUnits);
    if (bytes > this.limit) return value;
    const old = this.entries.get(key);
    if (old) {
      this.bytes -= old.bytes;
      this.entries.delete(key);
    }
    while (this.bytes + bytes > this.limit) {
      const [oldest, entry] = this.entries.entries().next().value!;
      this.bytes -= entry.bytes;
      this.entries.delete(oldest);
    }
    const copiedKey = flatString(key);
    this.entries.set(copiedKey, {
      key: copiedKey,
      value: detached.value,
      bytes,
    });
    this.bytes += bytes;
    return detached.value;
  }
}
