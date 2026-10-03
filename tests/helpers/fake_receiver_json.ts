/** Parse JSON while rejecting duplicate keys at every object depth. */
export function parseUniqueJson(source: string): unknown {
  let cursor = 0;

  const whitespace = (): void => {
    while (/[\t\n\r ]/u.test(source[cursor] ?? "")) cursor++;
  };
  const string = (): string => {
    const start = cursor;
    if (source[cursor++] !== '"') throw new SyntaxError("expected string");
    while (cursor < source.length) {
      const character = source[cursor++];
      if (character === '"')
        return JSON.parse(source.slice(start, cursor)) as string;
      if (character === "\\") cursor++;
      else if ((character?.codePointAt(0) ?? 0) < 0x20)
        throw new SyntaxError("invalid control character");
    }
    throw new SyntaxError("unterminated string");
  };
  const value = (): unknown => {
    whitespace();
    const character = source[cursor];
    if (character === '"') return string();
    if (character === "{") return object();
    if (character === "[") return array();
    const match =
      /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u.exec(
        source.slice(cursor),
      );
    if (!match) throw new SyntaxError("invalid JSON value");
    cursor += match[0].length;
    return JSON.parse(match[0]) as unknown;
  };
  const object = (): Record<string, unknown> => {
    cursor++;
    whitespace();
    const result = Object.create(null) as Record<string, unknown>;
    const keys = new Set<string>();
    if (source[cursor] === "}") {
      cursor++;
      return result;
    }
    while (true) {
      whitespace();
      const key = string();
      if (keys.has(key)) throw new SyntaxError("duplicate JSON key");
      keys.add(key);
      whitespace();
      if (source[cursor++] !== ":") throw new SyntaxError("expected colon");
      result[key] = value();
      whitespace();
      const separator = source[cursor++];
      if (separator === "}") return result;
      if (separator !== ",") throw new SyntaxError("expected comma");
    }
  };
  const array = (): unknown[] => {
    cursor++;
    whitespace();
    const result: unknown[] = [];
    if (source[cursor] === "]") {
      cursor++;
      return result;
    }
    while (true) {
      result.push(value());
      whitespace();
      const separator = source[cursor++];
      if (separator === "]") return result;
      if (separator !== ",") throw new SyntaxError("expected comma");
    }
  };

  const result = value();
  whitespace();
  if (cursor !== source.length) throw new SyntaxError("trailing JSON data");
  return result;
}
