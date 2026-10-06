/** Shared source-set token spans for discovery and move rewriting. */
export function extractSourceSetReferences(value: string): string[] {
  return sourceSetReferences(value).map(({ value }) => value);
}

/** Replace parsed URL spans without revisiting text written by a previous replacement. */
export function rewriteSourceSetReferences(
  value: string,
  rewrite: (reference: string) => string,
): string {
  for (const reference of sourceSetReferences(value).reverse())
    value =
      value.slice(0, reference.start) +
      rewrite(reference.value) +
      value.slice(reference.end);
  return value;
}

function sourceSetReferences(
  value: string,
): { start: number; end: number; value: string }[] {
  const references: { start: number; end: number; value: string }[] = [];
  let position = 0;
  while (position < value.length) {
    while (/[\s,]/.test(value[position] ?? "")) position += 1;
    const start = position;
    while (position < value.length && !/\s/.test(value[position] ?? "")) {
      position += 1;
    }
    const token = value.slice(start, position);
    const reference = token.replace(/,+$/, "");
    if (reference)
      references.push({
        start,
        end: start + reference.length,
        value: reference,
      });
    if (reference !== token) continue;
    while (position < value.length && value[position] !== ",") position += 1;
  }
  return references;
}
