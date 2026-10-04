/** Original marker offsets for bounded material-seam queries, built once per used side. */
export class MaterialMarkerOffsets {
  private readonly openers: number[] = [];
  private readonly closes: number[] = [];
  private readonly partialStarts: number[] = [];
  private readonly partialEnds: number[] = [];

  constructor(source: string) {
    const pattern = /<!--mokly-(?:review-|component:)|<!--mokly-|-->/g;
    for (const match of source.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (match[0] === "-->") {
        this.closes.push(end);
        continue;
      }
      if (match[0] === "<!--mokly-") {
        let matched = 0;
        for (const opener of ["<!--mokly-review-", "<!--mokly-component:"]) {
          let length = 0;
          while (
            length < opener.length &&
            source[start + length] === opener[length]
          )
            length++;
          matched = Math.max(matched, length);
        }
        this.partialStarts.push(start);
        this.partialEnds.push(start + matched);
        continue;
      }
      this.openers.push(start);
    }
  }

  /** Apply only complete closes and kept openers; no source text is rescanned. */
  openAfter(start: number, end: number, incoming: boolean): boolean {
    const opener = this.openers[precedingIndex(this.openers, end)];
    const close = this.closes[precedingIndex(this.closes, end + 1)];
    const partial = precedingIndex(this.partialStarts, end);
    const partialStart = this.partialStarts[partial];
    const pending =
      partialStart !== undefined &&
      partialStart >= start &&
      end <= this.partialEnds[partial]!
        ? partialStart
        : -1;
    const lastOpen = Math.max(
      opener !== undefined && opener >= start ? opener : -1,
      pending,
    );
    const lastClose =
      close !== undefined && close - 3 >= start ? close - 3 : -1;
    return (
      lastOpen > lastClose || (lastOpen === -1 && lastClose === -1 && incoming)
    );
  }
}

function precedingIndex(values: readonly number[], end: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (values[middle]! < end) low = middle + 1;
    else high = middle;
  }
  return low - 1;
}
