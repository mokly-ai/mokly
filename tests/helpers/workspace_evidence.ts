/** Compared-entry records and rendering shared by the workspace evidence tests. */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { RuleEvidence } from "../../packages/viewer/dist/catalogue/types.js";
import type {
  ComparedEntry,
  EntryChangeReason,
  ReviewView,
} from "../../packages/viewer/dist/review/types.js";
import type { WorkspaceData } from "../../packages/viewer/dist/shell/workspace_data.js";
import { WorkspaceEvidence } from "../../packages/viewer/dist/shell/workspace_evidence.js";

export const PAGE = { kind: "entry" } as const;

/** One review v8 rule record, owned by the page unless stated. */
export const record = (
  stylesheet: string,
  selector: string,
  status: RuleEvidence["status"] = "matched",
  owner: RuleEvidence["owner"] = PAGE,
): RuleEvidence => ({ stylesheet, selector, status, owner });

export function view(
  viewport: "mobile" | "desktop",
  state: ReviewView["state"],
  rules: RuleEvidence[],
): ReviewView {
  return { viewport, colorScheme: "light", state, ignoredIds: [], rules };
}

/** One changed entry's comparison facts: a screen, or a component with saved props. */
export function entry(
  kind: "screen" | "component",
  path: string,
  reasons: readonly EntryChangeReason[],
  views: ReviewView[],
): ComparedEntry {
  return {
    path,
    basePath: path,
    reasons,
    views,
    ...(kind === "component" ? { savedProps: { before: {}, after: {} } } : {}),
  };
}

/** The evidence markup, with the routed entry's comparison loaded when given. */
export function renderEvidence(
  data: WorkspaceData,
  variantPath?: string,
  comparison?: ComparedEntry,
): string {
  return renderToStaticMarkup(
    createElement(WorkspaceEvidence, {
      compared: comparison !== undefined,
      data: comparison ? { ...data, compared: comparison } : data,
      ...(variantPath ? { variantPath } : {}),
    }),
  );
}
