export function isAsciiWhitespace(character: string): boolean {
  return /[ \t\n\f\r]/.test(character);
}

export function asciiTrim(value: string): string {
  return value.replace(/^[ \t\n\f\r]+|[ \t\n\f\r]+$/g, "");
}

export function resolvedAddress(
  value: string,
  base?: string,
): string | undefined {
  try {
    return new URL(value, base).href;
  } catch {
    return undefined;
  }
}

/** Return a replacement only for a relative address the snapshot can resolve. */
export function relativeAddress(
  value: string,
  base: string,
  hyperlink = false,
): string | undefined {
  const trimmed = asciiTrim(value);
  if (!trimmed || (!hyperlink && trimmed.startsWith("#"))) return;
  if (resolvedAddress(value) !== undefined) return;
  return resolvedAddress(value, base);
}

/** Edit only the URL ranges from the HTML srcset candidate parser. */
export function rewriteSrcset(source: string, base: string): string {
  const pieces: string[] = [];
  let copied = 0;
  let position = 0;
  while (position < source.length) {
    while (
      isAsciiWhitespace(source.charAt(position)) ||
      source[position] === ","
    )
      position += 1;
    const start = position;
    while (
      position < source.length &&
      !isAsciiWhitespace(source.charAt(position))
    )
      position += 1;
    let end = position;
    while (end > start && source[end - 1] === ",") end -= 1;
    const address = relativeAddress(source.slice(start, end), base);
    if (address !== undefined) {
      pieces.push(source.slice(copied, start), address);
      copied = end;
    }
    if (end === position) position = skipDescriptors(source, position);
  }
  return pieces.length ? pieces.join("") + source.slice(copied) : source;
}

function skipDescriptors(source: string, position: number): number {
  let inParentheses = false;
  while (position < source.length) {
    const character = source.charAt(position++);
    if (inParentheses) {
      if (character === ")") inParentheses = false;
    } else {
      if (character === ",") break;
      if (character === "(") inParentheses = true;
    }
  }
  return position;
}
