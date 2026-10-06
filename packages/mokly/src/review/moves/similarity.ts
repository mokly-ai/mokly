/** Compare normalized light-scheme documents by the multiset of their lines. */
export function documentSimilarity(before: string, after: string): number {
  const base = lines(before);
  const head = lines(after);
  const total = base.length + head.length;
  if (!total) return 1;
  const available = new Map<string, number>();
  for (const line of base) available.set(line, (available.get(line) ?? 0) + 1);
  let shared = 0;
  for (const line of head) {
    const count = available.get(line) ?? 0;
    if (count > 0) {
      shared++;
      available.set(line, count - 1);
    }
  }
  return (2 * shared) / total;
}

function lines(document: string): string[] {
  if (!document) return [];
  const result = document.replace(/\r\n?/g, "\n").split("\n");
  if (result.at(-1) === "") result.pop();
  return result.map((line) => line.replace(/\s+$/u, ""));
}
