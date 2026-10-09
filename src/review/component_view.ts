import type { GeneratedComponentView, ViewReview } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

import type { PreparedComponentComparison } from "./component_projection_resources.js";
import { compareCompleteComponentView } from "./component_view_complete.js";
import { compareStyleOnlyView } from "./component_style_route.js";
import { compareUnchangedComponentView } from "./component_view_fast_path.js";
import { compareOneSidedComponentView } from "./component_view_material.js";
import { PageAnalysisPair } from "./page_pair.js";
import type {
  ComparedComponentView,
  ComponentViewContext,
} from "./component_view_types.js";
export type {
  ComparedComponentView,
  ComponentViewContext,
} from "./component_view_types.js";

/** Compare material and declared inputs without altering the retained view documents. */
export async function compareComponentView(
  context: ComponentViewContext,
  before: GeneratedComponentView | undefined,
  after: GeneratedComponentView | undefined,
  root?: string,
): Promise<ComparedComponentView> {
  if (before?.usage && context.beforeUsage)
    before = { ...before, usage: context.beforeUsage(before.usage) };
  const selected = after ?? before;
  if (!selected)
    throw new MoklyError(
      "review-invalid",
      "Comparison view requires at least one side",
    );
  const base = before
    ? await context.beforeReader.text(before.path)
    : undefined;
  const head = after ? await context.afterReader.text(after.path) : undefined;
  const view: ViewReview = {
    viewport: selected.viewport,
    colorScheme: selected.colorScheme,
    ignoredIds: [],
    state: before ? "removed" : "added",
  };
  if (base === undefined || head === undefined)
    return compareOneSidedComponentView(
      context,
      before,
      after,
      base ?? head!,
      view,
      root,
    );
  let prepared: PreparedComponentComparison | undefined;
  const pages = context.componentAware
    ? new PageAnalysisPair(
        before!,
        after!,
        base,
        head,
        context.links?.(before!.path, after!.path),
        root,
      )
    : undefined;
  if (context.useFastPath !== false) {
    const attempt = await compareUnchangedComponentView(
      context,
      before!,
      after!,
      view,
      base,
      head,
      root,
      pages,
    );
    if (attempt.comparison) return attempt.comparison;
    prepared = attempt.prepared;
  }
  if (pages && context.useStylePath !== false) {
    const comparison = await compareStyleOnlyView(context, pages, view, root);
    if (comparison) return comparison;
  }
  return compareCompleteComponentView(
    context,
    before!,
    after!,
    base,
    head,
    view,
    root,
    pages,
    prepared,
  );
}
