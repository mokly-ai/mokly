/** Independent JSON reader: reject BOM, invalid UTF-8 and duplicate object keys. */
export function decode(bytes: Uint8Array): unknown {
  const text = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: true,
  }).decode(bytes);
  const value: unknown = JSON.parse(text);
  let offset = 0;
  const white = () => {
    while (/\s/u.test(text[offset] ?? "") && offset < text.length) offset++;
  };
  const string = () => {
    const start = offset++;
    while (offset < text.length) {
      if (text[offset++] === "\\") offset++;
      else if (text[offset - 1] === '"') break;
    }
    return JSON.parse(text.slice(start, offset)) as string;
  };
  const walk = () => {
    white();
    if (text[offset] === '"') {
      string();
      return;
    }
    const opener = text[offset];
    if (opener === "{" || opener === "[") {
      offset++;
      white();
      const close = opener === "{" ? "}" : "]";
      const keys = new Set<string>();
      while (text[offset] !== close) {
        if (opener === "{") {
          const key = string();
          if (keys.has(key)) throw new Error("invalid");
          keys.add(key);
          white();
          offset++;
        }
        walk();
        white();
        if (text[offset] === ",") {
          offset++;
          white();
        }
      }
      offset++;
      return;
    }
    while (offset < text.length && !/[\s,\]}]/u.test(text[offset]!)) offset++;
  };
  walk();
  return value;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid");
  return value as Record<string, unknown>;
}
export const size = (value: string) => Buffer.byteLength(value, "utf8");
export const unicode = (value: string) =>
  Buffer.from(value).toString() === value;
export const controls = (value: string) =>
  [...value].some((character) => {
    const point = character.codePointAt(0) ?? 0;
    return point < 32 || (point >= 127 && point <= 159);
  });
export function portable(value: string): boolean {
  return (
    !!value &&
    unicode(value) &&
    !controls(value) &&
    !/[\\:]/u.test(value) &&
    value
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}
