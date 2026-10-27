/** Factual comparison evidence rendered only in the Details inspector panel. */

import { Fragment } from "react";

import { decodeProps } from "../components/codec.js";
import { viewHref } from "../navigation/routes.js";
import type { ChangeReason } from "../review/types.js";

import { entryWording } from "./entry_wording.js";
import { ComparisonHeading, StylesheetDetails } from "./evidence_details.js";
import type { WorkspaceData } from "./workspace_data.js";
import { workspaceComparisonEvidence } from "./workspace_evidence_data.js";
import { propText } from "./workspace_props.js";

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
  const wording = entryWording(data.entry.kind);
  const hidden = data.status === undefined && !evidence.comparison;
  const savedView = data.variants.find(
    (item) => item.value.path === variantPath,
  );
  const ignored = evidence.comparison
    ? [...new Set(evidence.views.flatMap((view) => view.ignoredIds))]
    : [];
  const savedProps = evidence.comparison?.savedProps;
  return (
    <section
      className="mbk-comparison-evidence"
      data-workspace-evidence=""
      hidden={hidden}
    >
      {!hidden ? (
        <>
          <ComparisonHeading base={data.base} />
          {previousPath ? (
            <p>
              The previous version is at{" "}
              <code className="mbk-code">{previousPath}</code>, where it was
              before the move.
            </p>
          ) : null}
          {evidence.reasons.map((reason, index) => (
            <Reason key={`${reasonKey(reason)}/${index}`} reason={reason} />
          ))}
          <StylesheetDetails
            reasons={evidence.reasons}
            resources={evidence.resourceViews}
            subject={
              data.entry.kind === "component"
                ? { kind: "component", componentId: evidence.componentId }
                : { kind: "screen" }
            }
          />
          {data.inputChanges
            .filter((item) => item.variantPath === variantPath)
            .map((change) => (
              <Fragment
                key={`${change.instanceId}/${change.viewport}/${change.colorScheme}`}
              >
                <h3>
                  {change.title} · {change.instanceId} · {change.viewport} ·{" "}
                  {change.colorScheme}
                </h3>
                <p>Before</p>
                <pre>{propText(decodeProps(change.before))}</pre>
                <p>Current</p>
                <pre>{propText(decodeProps(change.after))}</pre>
              </Fragment>
            ))}
          {data.relatedComponents.map((component) => (
            <p key={component.path}>
              Changed component:{" "}
              <a href={viewHref(component.path)}>{component.title}</a>
            </p>
          ))}
          {ignored.length ? (
            <p>Excluded content: {ignored.join(", ")}.</p>
          ) : null}
          {evidence.sharedImpact ? <p>{wording.sharedImpact}</p> : null}
          {savedProps &&
          JSON.stringify(savedProps.before) !==
            JSON.stringify(savedProps.after) ? (
            <>
              <h3>Saved props changed</h3>
              <p>Before</p>
              <pre>{propText(decodeProps(savedProps.before))}</pre>
              <p>Current</p>
              <pre>{propText(decodeProps(savedProps.after))}</pre>
            </>
          ) : null}
          {!evidence.sharedImpact &&
          data.status === "Unmodified" &&
          (savedView?.status ?? "Unmodified") === "Unmodified" ? (
            <p>{wording.noChanges}</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/**
 * One reason's sentence from the component workspace design's table. A
 * `dependency` reads only through the changed files, and a `screen` reason,
 * which only a use case carries, has no sentence.
 */
function Reason({ reason }: { reason: ChangeReason }) {
  if (reason.kind === "dependency" || reason.kind === "screen") return null;
  const labels = {
    added: "Added to this branch.",
    removed: "Removed on this branch.",
    material: "Rendered content changed.",
    implementation: "Rendered content changed where this component is used.",
    inputs: "Supplied props or slots changed.",
    structure: "Component instances changed.",
    metadata: "Page details or saved examples changed.",
  } as const;
  return <p>{labels[reason.kind]}</p>;
}

function reasonKey(reason: ChangeReason): string {
  return reason.kind === "dependency"
    ? `${reason.kind}/${reason.path}`
    : reason.kind === "screen"
      ? `${reason.kind}/${reason.screenPath}`
      : reason.kind;
}
