/** Review records and rendering shared by the workspace evidence tests. */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { RuleEvidence } from "../../packages/viewer/dist/catalogue/types.js";
import { parseReviewResult } from "../../packages/viewer/dist/review/result_validation.js";
import type {
  ReviewEntry,
  ReviewResult,
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

/** One changed entry record: a screen, or a component with these props. */
export function entry(
  kind: "screen" | "component",
  path: string,
  title: string,
  reasons: ReviewEntry["reasons"],
  views: ReviewView[],
): ReviewEntry {
  const side = {
    path,
    title,
    props: {},
    ...(kind === "component" ? { suppliedSlots: [] } : {}),
  };
  const state = "changed";
  return {
    kind,
    path,
    title,
    before: side,
    after: side,
    state,
    included: true,
    reasons,
    views,
  };
}

/** A loaded comparison that holds one entry record. */
export function loaded(entry: ReviewEntry): ReviewResult {
  return parseReviewResult({
    schemaVersion: 8,
    baseCommit: "a".repeat(40),
    entries: [entry],
    affected: [],
    diagnostics: [],
  });
}

export function renderEvidence(
  data: WorkspaceData,
  variantPath?: string,
  comparison?: ReviewResult,
): string {
  return renderToStaticMarkup(
    createElement(WorkspaceEvidence, {
      data,
      ...(variantPath ? { variantPath } : {}),
      ...(comparison ? { loaded: comparison } : {}),
    }),
  );
}
