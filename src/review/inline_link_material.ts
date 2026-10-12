/** Keep style bytes visible when path normalization changes material equality. */
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
  if (analysis.status === "skipped") {
    if (links.equalSource === true) return false;
    return (["before", "after"] as const).some((side) =>
      (side === "before" ? analysis.beforeSpans : analysis.afterSpans).some(
        ({ source }) => links[side](source) !== source,
      ),
    );
  }
  return (["actual", "projected"] as const).some((kind) => {
    const base = text.before[kind].appendix;
    const head = text.after[kind].appendix;
    return (links.before(base) === links.after(head)) !== (base === head);
  });
}
