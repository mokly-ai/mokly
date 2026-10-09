/** Material normalization and evidence delivery, independent of view orchestration. */
import type {
  GeneratedComponentView,
  ViewReview,
  InlineStyleEvidence,
  EntryChangeReason,
} from "@mokly/viewer/data";

import { stripMarkers } from "../components/comparison_material.js";
import { materialRecipe } from "../components/material_recipe.js";
import { validateComponentRanges } from "../components/ranges.js";

import type { InlineResourceOwners } from "./component_inline_resources.js";
import type { PreparedInlineStyleEvidence } from "./component_projection_resources.js";
import { insertedStylesheetResources } from "./component_stylesheet_resources.js";
import { componentCssDocuments } from "./css/containment.js";
import { ownedResourceReasons } from "./component_resource_attribution.js";
import type {
  ComponentViewContext,
  ComparedComponentView,
} from "./component_view.js";
import { normalizeSingleDocument } from "./ignore.js";
import { PageAnalysis } from "./page_analysis.js";

const EMPTY_INLINE_OWNERS: InlineResourceOwners = new Map();

export function deliveredInlineStyles(
  evidence: PreparedInlineStyleEvidence | undefined,
  view: ViewReview,
  reasons: readonly EntryChangeReason[],
): { inlineStyles?: InlineStyleEvidence } {
  if (evidence?.retainedSelectors && view.state === "changed" && view.material)
    return { inlineStyles: evidence.retainedSelectors };
  if (
    evidence?.allExcluded &&
    reasons.length === 0 &&
    view.state === "unchanged" &&
    !view.material &&
    !view.reasons
  )
    return { inlineStyles: { status: "excluded" } };
  return {};
}

function normalizeOneSidedView(
  html: string,
  view: GeneratedComponentView,
): string {
  const ranges = view.usage
    ? validateComponentRanges(html, view.usage.ranges)
    : undefined;
  const material = stripMarkers(html, view.usage, ranges);
  return normalizeSingleDocument(material, view.path);
}

export async function compareOneSidedComponentView(
  context: ComponentViewContext,
  before: GeneratedComponentView | undefined,
  after: GeneratedComponentView | undefined,
  source: string,
  view: ViewReview,
  root?: string,
): Promise<ComparedComponentView> {
  const selected = (after ?? before)!;
  const analysis = context.componentAware
    ? new PageAnalysis(source, selected.path, selected.usage)
    : undefined;
  const material = analysis ? source : normalizeOneSidedView(source, selected);
  const references = analysis?.materialReferences(
    materialRecipe(analysis.source, { replacements: [], appendix: "" }),
    [],
  );
  const insertedStylesheets = insertedStylesheetResources(
    source,
    selected.usage,
    selected.path,
  );
  const evidence = await context.resources.compare(
    before
      ? {
          path: before.path,
          html: material,
          insertedStylesheets,
          ...(references ? { references } : {}),
        }
      : undefined,
    after
      ? {
          path: after.path,
          html: material,
          insertedStylesheets,
          ...(references ? { references } : {}),
        }
      : undefined,
    undefined,
    analysis
      ? {
          before: before ? analysis.matching([]) : undefined,
          after: after ? analysis.matching([]) : undefined,
        }
      : undefined,
    () => [
      componentCssDocuments(
        before ? source : undefined,
        after ? source : undefined,
        selected.path,
        before?.usage,
        after?.usage,
        root,
      ),
    ],
  );
  return {
    comparisonPath: "complete",
    view: { ...view, ...evidence, material: true },
    reasons: [{ kind: "material" }, ...(evidence.reasons ?? [])],
    changedImplementations: new Set(),
    ownedResources: ownedResourceReasons(
      evidence.reasons ?? [],
      context.prefix,
      EMPTY_INLINE_OWNERS,
      before?.usage,
      after?.usage,
      root,
    ),
  };
}
