/** Exact edits in JavaScript's UTF-16 source coordinate space. */
export interface TextPatch {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** Apply successive edit stages and translate only preserved source ranges. */
export class TextOffsetMap {
  private current: string;
  private readonly stages: (readonly TextPatch[])[] = [];

  constructor(readonly source: string) {
    this.current = source;
  }

  get html(): string {
    return this.current;
  }

  /** Each stage uses offsets into the preceding stage's output. */
  apply(patches: readonly TextPatch[]): string {
    const ordered = [...patches].sort(
      (a, b) => a.start - b.start || a.end - b.end,
    );
    let cursor = 0;
    const pieces: string[] = [];
    for (const patch of ordered) {
      if (
        !Number.isSafeInteger(patch.start) ||
        !Number.isSafeInteger(patch.end) ||
        patch.start < cursor ||
        patch.end < patch.start ||
        patch.end > this.current.length
      )
        throw new Error("Invalid or overlapping text patches");
      pieces.push(this.current.slice(cursor, patch.start), patch.text);
      cursor = patch.end;
    }
    pieces.push(this.current.slice(cursor));
    this.current = pieces.join("");
    this.stages.push(ordered);
    return this.current;
  }

  /** Insertions on the outer boundaries do not become owned source text. */
  range(start: number, end: number): { start: number; end: number } {
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end <= start ||
      end > this.source.length
    )
      throw new Error("Invalid source range for text patches");
    for (const patches of this.stages) {
      let adjustment = 0;
      for (const patch of patches) {
        if (patch.end <= start)
          adjustment += patch.text.length - (patch.end - patch.start);
        else if (patch.start < end)
          throw new Error(
            "Text patch destroys a preserved source range or boundary",
          );
      }
      start += adjustment;
      end += adjustment;
    }
    return { start, end };
  }
}
