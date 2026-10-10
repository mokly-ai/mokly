/** Exact opt-in comparison-material counts, separate from the core hot collector. */
export class MaterialWork {
  private readonly counts = {
    materialBytes: 0,
    materialNormalizationBytes: 0,
    sourceNormalizationBytes: 0,
    materialHashBytes: 0,
    inlineFingerprintBytes: 0,
    inlineFingerprintHashes: 0,
    fingerprintedViews: 0,
    fingerprintSeams: 0,
    fingerprintSeamUnits: 0,
  };
  private materialScope = false;

  material<T>(operation: () => T): T {
    const previous = this.materialScope;
    this.materialScope = true;
    try {
      return operation();
    } finally {
      this.materialScope = previous;
    }
  }

  materials(sources: readonly string[]): void {
    for (const source of sources)
      this.counts.materialBytes += Buffer.byteLength(source, "utf8");
  }

  normalization(source: string): void {
    const field = this.materialScope
      ? "materialNormalizationBytes"
      : "sourceNormalizationBytes";
    this.counts[field] += Buffer.byteLength(source, "utf8");
  }

  materialHash(source: string): void {
    this.counts.materialHashBytes += Buffer.byteLength(source, "utf8");
  }

  inlineFingerprint(source: string): void {
    this.counts.inlineFingerprintBytes += Buffer.byteLength(source, "utf8");
    this.counts.inlineFingerprintHashes++;
  }

  fingerprintedView(): void {
    this.counts.fingerprintedViews++;
  }

  fingerprintSeam(units: number): void {
    this.counts.fingerprintSeams++;
    this.counts.fingerprintSeamUnits += units;
  }

  record(): Readonly<Record<string, number>> {
    return { ...this.counts };
  }
}
