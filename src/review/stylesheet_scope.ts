/** A stylesheet scope follows CSS imports but never enters an embedded document. */
import { isStylesheetPath } from "@mokly/viewer/data";

export async function collectStylesheetScope(
  seeds: readonly string[],
  readReferences: (route: string) => Promise<readonly string[]>,
): Promise<ReadonlySet<string>> {
  const found = new Set<string>();
  const pending = seeds.filter(isStylesheetPath);
  while (pending.length) {
    const stylesheet = pending.pop()!;
    if (found.has(stylesheet)) continue;
    found.add(stylesheet);
    pending.push(
      ...(await readReferences(stylesheet)).filter(isStylesheetPath),
    );
  }
  return found;
}
