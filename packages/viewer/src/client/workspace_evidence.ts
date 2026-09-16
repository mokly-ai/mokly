/** Factual comparison evidence belongs in Details, never in the canvas. */
import { decodeProps } from "../components/codec.js";
import type { ReviewResult } from "../review/types.js";
import type { WorkspaceData } from "../shell/workspace_data.js";

import { entryWording } from "./entry_wording.js";
import { element } from "./inspector_panels.js";
import { propText } from "./prop_display.js";
import {
  appendChangedFiles,
  appendExcludedStylesheets,
  appendStyleOutcomes,
  excludedStylesheets,
  retainedPaths,
  styleOutcomes,
} from "./style_evidence.js";
import { workspaceComparisonEvidence } from "./workspace_evidence_data.js";

/**
 * Merge classification with loaded evidence; loaded details win, preserving
 * selector unions and unresolved precedence. Retained paths suppress exclusions
 * across all selected views. Only Unmodified gets the terminal no-changes line.
 * See docs/protocol/mokly-css-evidence-shell.md#shell-derivation.
 */
export function renderWorkspaceEvidence(
  panel: HTMLElement,
  data: WorkspaceData,
  variantId?: string,
  loaded?: ReviewResult,
): void {
  const doc = panel.ownerDocument;
  const evidence = workspaceComparisonEvidence(data, variantId, loaded);
  panel.replaceChildren();
  panel.hidden = data.status === undefined && !evidence.comparison;
  if (panel.hidden) return;
  panel.append(
    element(doc, "h3", "Comparison details"),
    element(doc, "p", `Compared with the branch point on ${data.base}.`),
  );
  const labels = {
    added: "Added to this branch.",
    removed: "Removed on this branch.",
    material: "Rendered content changed.",
    inputs: "Supplied props or slots changed.",
    structure: "Component instances changed.",
    metadata: "Page details or saved examples changed.",
  };
  for (const component of data.relatedComponents) {
    const link = element(doc, "a", component.title);
    link.href = `/view/${component.route.split("/").map(encodeURIComponent).join("/")}`;
    const row = element(doc, "p", "Changed component: ");
    row.append(link);
    panel.append(row);
  }
  for (const change of data.inputChanges.filter(
    (item) => item.variantId === variantId,
  )) {
    panel.append(
      element(
        doc,
        "h3",
        `${change.title} · ${change.instanceId} · ${change.viewport} · ${change.colorScheme}`,
      ),
    );
    for (const [label, props] of [
      ["Before", change.before],
      ["Current", change.after],
    ] as const)
      panel.append(
        element(doc, "p", label),
        element(doc, "pre", propText(decodeProps(props))),
      );
  }
  for (const reason of evidence.reasons)
    if (reason.kind !== "dependency")
      panel.append(
        element(
          doc,
          "p",
          reason.kind === "screen"
            ? `A screen in this flow changed: ${reason.route}`
            : labels[reason.kind],
        ),
      );
  const retained = [
    ...new Set([...retainedPaths(evidence.reasons), ...evidence.legacyPaths]),
  ].sort();
  appendChangedFiles(doc, panel, retained);
  appendStyleOutcomes(doc, panel, styleOutcomes(evidence.reasons));
  appendExcludedStylesheets(
    doc,
    panel,
    excludedStylesheets(evidence.resourceViews, retained),
  );
  const { comparison, views } = evidence;
  if (comparison) {
    const ignored = [...new Set(views.flatMap((view) => view.ignoredIds))];
    if (ignored.length)
      panel.append(
        element(doc, "p", `Excluded content: ${ignored.join(", ")}.`),
      );
    if (
      data.comparison &&
      !data.change &&
      views.some((view) => view.state === "changed")
    )
      panel.append(
        element(
          doc,
          "p",
          "Shared component changes affect this preview. This page has no independent entry in Changes.",
        ),
      );
    if ("variants" in comparison) {
      const variant = comparison.variants.find((item) => item.id === variantId);
      if (
        variant?.before &&
        variant.after &&
        JSON.stringify(variant.before.props) !==
          JSON.stringify(variant.after.props)
      ) {
        panel.append(element(doc, "h3", "Saved props changed"));
        for (const [title, props] of [
          ["Before", variant.before.props],
          ["Current", variant.after.props],
        ] as const)
          panel.append(
            element(doc, "p", title),
            element(doc, "pre", propText(decodeProps(props))),
          );
      }
    }
  }
  if (data.status === "Unmodified")
    panel.append(element(doc, "p", entryWording(data.entry.kind).noChanges));
}
