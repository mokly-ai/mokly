import type { UsageLink } from "./workspace_data.js";

/** Keep the first complete serialized link in evidence order, serializing each input once. */
export function dedupeUsageLinks(links: readonly UsageLink[]): UsageLink[] {
  const seen = new Set<string>();
  const result: UsageLink[] = [];
  for (const link of links) {
    const key = JSON.stringify(link);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(link);
  }
  return result;
}
