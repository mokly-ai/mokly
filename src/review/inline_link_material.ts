/** Keep style bytes visible when path normalization changes the text oracle's material. */
import type { InlineAttributionResult } from "./css/inline_attribution.js";
import type { InlineMaterialReplacements } from "./css/inline_rendering.js";
import type { PageAnalysisPair } from "./page_pair.js";

export function inlineLinkMaterialChanges(
  pages: PageAnalysisPair,
  analysis: InlineAttributionResult,
  text: {
    before: InlineMaterialReplacements;
    after: InlineMaterialReplacements;
  },
): boolean {
  const links = pages.links;
  if (!links) return false;
  return (["before", "after"] as const).some((side) => {
    const sources =
      analysis.status === "skipped"
        ? (side === "before" ? analysis.beforeSpans : analysis.afterSpans).map(
            ({ source }) => source,
          )
        : [text[side].actual.appendix, text[side].projected.appendix];
    return sources.some((source) => links[side](source) !== source);
  });
}
