interface Edit {
  start: number;
  end: number;
  text: string;
}

interface Token {
  start: number;
  end: number;
  type: { label: string };
  loc: { start: { line: number; column: number } };
}

/** Column translations from the compiler's edited input to the authored JSX. */
export type StorySite = [line: number, compiled: number, authored: number];

export class StoryBodyEdits {
  private edits: Edit[] = [];

  constructor(
    private readonly source: string,
    private readonly tokens: readonly Token[],
  ) {}

  get changed(): boolean {
    return this.edits.length > 0;
  }

  token(label: string, from: number, before: number): Token {
    let low = 0;
    let high = this.tokens.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.tokens[middle]!.start < from) low = middle + 1;
      else high = middle;
    }
    for (let index = low; index < this.tokens.length; index++) {
      const token = this.tokens[index]!;
      if (token.start >= before) break;
      if (token.type.label === label) return token;
    }
    throw new Error(`missing ${label} in component declaration`);
  }

  insert(start: number, text: string): void {
    this.replace(start, start, text);
  }

  replace(start: number, end: number, text: string): void {
    this.edits.push({ start, end, text });
  }

  finish(): { code: string; sites: StorySite[] } {
    const edits = this.edits.sort(
      (left, right) => left.start - right.start || left.end - right.end,
    );
    const code: string[] = [];
    let from = 0;
    for (const edit of edits) {
      code.push(this.source.slice(from, edit.start), edit.text);
      from = edit.end;
    }
    code.push(this.source.slice(from));

    const sites: StorySite[] = [];
    let index = 0;
    let line = 0;
    let shift = 0;
    for (const token of this.tokens) {
      if (
        token.type.label !== "jsxTagStart" ||
        this.source[token.start + 1] === "/"
      )
        continue;
      const site = token.loc.start;
      if (site.line !== line) {
        line = site.line;
        shift = 0;
      }
      const lineStart = token.start - site.column;
      for (
        ;
        index < edits.length && edits[index]!.end <= token.start;
        index++
      ) {
        const edit = edits[index]!;
        if (edit.start >= lineStart)
          shift += edit.text.length - (edit.end - edit.start);
      }
      sites.push([line, site.column + shift + 1, site.column + 1]);
    }
    return { code: code.join(""), sites };
  }
}
