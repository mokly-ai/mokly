/**
 * Factual comparison evidence rendered only in the Details inspector panel.
 * This container projects the evidence, words each reason, and decides which
 * facts show. `@mokly/ui/comparison-evidence` renders them in the designs'
 * order.
 */

import {
  ComparisonEvidence,
  type EvidenceReason,
} from "@mokly/ui/comparison-evidence";

import { decodeProps } from "../components/codec.js";
import { viewHref } from "../navigation/routes.js";
import type { ChangeReason } from "../review/types.js";

import { entryWording } from "./entry_wording.js";
import { stylesheetDetails } from "./evidence_details.js";
import type { WorkspaceData } from "./workspace_data.js";
import { workspaceComparisonEvidence } from "./workspace_evidence_data.js";
import { propText } from "./workspace_props.js";

/**
 * Each reason's sentence from the component workspace design's table. A
 * `dependency` reads only through the changed files, and a `screen` reason,
 * which only a use case carries, has no sentence.
 */
const REASON_SENTENCES = {
  added: "Added to this branch.",
  removed: "Removed on this branch.",
  material: "Rendered content changed.",
  implementation: "Rendered content changed where this component is used.",
  inputs: "Supplied props or slots changed.",
  structure: "Component instances changed.",
  metadata: "Page details or saved examples changed.",
} as const;

/** The sentence of each reason that has one, keyed as the list was. */
function reasonSentences(reasons: readonly ChangeReason[]): EvidenceReason[] {
  return reasons.flatMap((reason, index) =>
    reason.kind === "dependency" || reason.kind === "screen"
      ? []
      : [
          {
            key: `${reasonKey(reason)}/${index}`,
            text: REASON_SENTENCES[reason.kind],
          },
        ],
  );
}

function reasonKey(reason: ChangeReason): string {
  return reason.kind === "dependency"
    ? `${reason.kind}/${reason.path}`
    : reason.kind === "screen"
      ? `${reason.kind}/${reason.screenPath}`
      : reason.kind;
}

/**
 * Comparison facts for the current entry and, once a comparison loads, its
 * compared views, in the designs' order: the branch point and, for a moved entry, the path its
 * earlier side comes from; one sentence per reason; the changed and excluded
 * stylesheets; the paired prop values; then the changed components used here.
 * An entry that only changed components affect ends with their explanation in
 * place of the no-changes line.
 */
export function WorkspaceEvidence({
  compared = false,
  data,
  previousPath,
  variantPath,
}: {
  /** A comparison of the routed entry is loaded. */
  compared?: boolean;
  data: WorkspaceData;
  previousPath?: string;
  variantPath?: string;
}) {
  const evidence = workspaceComparisonEvidence(data, compared);
  const hidden = data.status === undefined && !evidence.comparison;
  if (hidden)
    return (
      <ComparisonEvidence
        base={data.base}
        hidden
        mark="data-workspace-evidence"
      />
    );
  const wording = entryWording(data.entry.kind);
  const savedView = data.variants.find(
    (item) => item.value.path === variantPath,
  );
  const savedProps = evidence.comparison?.savedProps;
  return (
    <ComparisonEvidence
      base={data.base}
      changedComponents={data.relatedComponents.map((component) => ({
        href: viewHref(component.path),
        key: component.path,
        title: component.title,
      }))}
      hidden={false}
      ignored={
        evidence.comparison
          ? [...new Set(evidence.views.flatMap((view) => view.ignoredIds))]
          : []
      }
      inputChanges={data.inputChanges
        .filter((item) => item.variantPath === variantPath)
        .map((change) => ({
          after: propText(decodeProps(change.after)),
          before: propText(decodeProps(change.before)),
          colorScheme: change.colorScheme,
          instanceId: change.instanceId,
          key: `${change.instanceId}/${change.viewport}/${change.colorScheme}`,
          title: change.title,
          viewport: change.viewport,
        }))}
      mark="data-workspace-evidence"
      noChanges={
        !evidence.sharedImpact &&
        data.status === "Unmodified" &&
        (savedView?.status ?? "Unmodified") === "Unmodified"
          ? wording.noChanges
          : undefined
      }
      previousPath={previousPath}
      reasons={reasonSentences(evidence.reasons)}
      savedProps={
        savedProps &&
        JSON.stringify(savedProps.before) !== JSON.stringify(savedProps.after)
          ? {
              after: propText(decodeProps(savedProps.after)),
              before: propText(decodeProps(savedProps.before)),
            }
          : undefined
      }
      sharedImpact={evidence.sharedImpact ? wording.sharedImpact : undefined}
      {...stylesheetDetails(
        evidence.reasons,
        evidence.resourceViews,
        data.entry.kind === "component"
          ? { kind: "component", componentId: evidence.componentId }
          : { kind: "screen" },
      )}
    />
  );
}
