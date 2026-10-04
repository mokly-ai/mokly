/** Conservative source offsets for style copies assembled across material seams. */
export class StyleSeamOffsets {
  private readonly starts: number[] = [];
  private readonly ends: number[] = [];
  readonly endings: readonly string[];

  constructor(source: string, skippedSources: readonly string[]) {
    this.endings = [
      ...new Set(skippedSources.map((style) => style.slice(-12))),
    ];
    for (const match of source.matchAll(/<style/gi))
      this.starts.push(match.index);
    const ends = new Set<number>();
    for (const ending of this.endings)
      for (
        let offset = source.indexOf(ending);
        offset !== -1;
        offset = source.indexOf(ending, offset + 1)
      )
        ends.add(offset);
    this.ends = [...ends].sort((a, b) => a - b);
  }

  hasStart(start: number, end: number): boolean {
    return includes(this.starts, start, end - "<style".length);
  }

  hasEnd(start: number, end: number): boolean {
    return includes(this.ends, start, end - 12);
  }
}

function includes(offsets: readonly number[], start: number, end: number) {
  let low = 0;
  let high = offsets.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (offsets[middle]! < start) low = middle + 1;
    else high = middle;
  }
  return offsets[low] !== undefined && offsets[low]! <= end;
}
