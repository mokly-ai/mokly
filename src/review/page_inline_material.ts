/** Fingerprint complete-path materials while preserving the delivered text oracle. */
import { createHash } from "node:crypto";

import { timingMaterialWork } from "../diagnostics/material_timings.js";
import { documentWorkSync } from "../diagnostics/timings.js";

import type { InlineAttributionResult } from "./css/inline_attribution.js";
import {
  inlineMaterialReplacements,
  withInlineAppendix,
  type InlineMaterialReplacements,
} from "./css/inline_rendering.js";
import { inlineLinkMaterialChanges } from "./inline_link_material.js";
import { hasFingerprintSeam } from "./page_fingerprint_guard.js";
import type { PageAnalysisPair } from "./page_pair.js";
import { isPageResourceReference } from "./page_reference_records.js";
import { styleNeedsFullValidation } from "./style_source_safety.js";

interface MaterialOptions {
  fingerprints: boolean;
  reuseSourceSafety: boolean;
}

export function pageInlineMaterials(
  analysis: InlineAttributionResult | undefined,
  base: string,
  head: string,
  options: MaterialOptions,
  pages?: PageAnalysisPair,
): { before: InlineMaterialReplacements; after: InlineMaterialReplacements } {
  return documentWorkSync("inlineRuleMs", () =>
    prepareMaterials(analysis, base, head, options, pages),
  );
}

function prepareMaterials(
  analysis: InlineAttributionResult | undefined,
  base: string,
  head: string,
  options: MaterialOptions,
  pages?: PageAnalysisPair,
): { before: InlineMaterialReplacements; after: InlineMaterialReplacements } {
  const empty = {
    actual: { replacements: [], appendix: "" },
    projected: { replacements: [], appendix: "" },
  } as const;
  const text = analysis
    ? {
        before: inlineMaterialReplacements(analysis, "before"),
        after: inlineMaterialReplacements(analysis, "after"),
      }
    : { before: empty, after: empty };
  if (
    !options.fingerprints ||
    !pages ||
    !analysis ||
    (analysis.status === "skipped" &&
      !analysis.beforeSpans.length &&
      !analysis.afterSpans.length) ||
    analysis.status === "unresolved" ||
    base.includes("mokly-inline-") ||
    head.includes("mokly-inline-") ||
    unsafeStyleSources(analysis, pages, options.reuseSourceSafety) ||
    skippedSourceReferences(analysis, pages) ||
    inlineLinkMaterialChanges(pages, analysis, text) ||
    (analysis.status === "skipped" &&
      (pages.beforeAnalysis.sourceEditsIntersect(analysis.beforeSpans) ||
        pages.afterAnalysis.sourceEditsIntersect(analysis.afterSpans) ||
        !pages.fingerprintProofs.occurrencesEligible(
          "before",
          analysis.beforeSpans,
        ) ||
        !pages.fingerprintProofs.occurrencesEligible(
          "after",
          analysis.afterSpans,
        ))) ||
    [text.before, text.after].some((side) =>
      [side.actual, side.projected].some(({ appendix }) =>
        appendix.includes("<!--mokly-"),
      ),
    ) ||
    hasFingerprintSeam(pages, text, analysis.status === "skipped")
  )
    return text;

  const digests = new Map<string, string>();
  const comment = (kind: "rules" | "style", source: string): string => {
    let digest = digests.get(source);
    if (digest === undefined) {
      timingMaterialWork()?.inlineFingerprint(source);
      digest = documentWorkSync("hashMs", () =>
        createHash("sha256").update(source, "utf8").digest("base64url"),
      );
      digests.set(source, digest);
    }
    return `<!--mokly-inline-${kind}:${digest}-->`;
  };
  const side = (which: "before" | "after"): InlineMaterialReplacements => {
    if (analysis.status === "skipped") {
      const spans =
        which === "before" ? analysis.beforeSpans : analysis.afterSpans;
      const projection = {
        replacements: spans.map(({ start, end, source }) => ({
          start,
          end,
          text: comment("style", source),
        })),
        appendix: "",
      };
      return { actual: projection, projected: projection };
    }
    const { actual, projected } = text[which];
    return {
      actual: withInlineAppendix(
        actual,
        comment("rules", actual.appendix.slice(7, -8)),
      ),
      projected: withInlineAppendix(
        projected,
        comment("rules", projected.appendix.slice(7, -8)),
      ),
    };
  };
  const result = { before: side("before"), after: side("after") };
  timingMaterialWork()?.fingerprintedView();
  return result;
}

function unsafeStyleSources(
  analysis: InlineAttributionResult,
  pages: PageAnalysisPair,
  reuse: boolean,
): boolean {
  if (
    reuse &&
    analysis.status === "skipped" &&
    pages.hasStyleSafetyProof(analysis.beforeSpans, analysis.afterSpans)
  )
    return false;
  return [...analysis.beforeSpans, ...analysis.afterSpans].some(
    styleNeedsFullValidation,
  );
}

function skippedSourceReferences(
  analysis: InlineAttributionResult,
  pages: PageAnalysisPair,
): boolean {
  if (analysis.status !== "skipped") return false;
  return (["before", "after"] as const).some((side) => {
    const page = side === "before" ? pages.beforeAnalysis : pages.afterAnalysis;
    const spans =
      side === "before" ? analysis.beforeSpans : analysis.afterSpans;
    return spans.some((span) =>
      page.references.some(
        (record) =>
          isPageResourceReference(record) &&
          span.start <= record.start &&
          record.end <= span.end,
      ),
    );
  });
}
