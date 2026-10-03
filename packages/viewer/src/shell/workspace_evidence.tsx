/** Factual comparison evidence rendered only in the Details inspector panel. */

import { Fragment } from "react";

import { decodeProps } from "../components/codec.js";
import { viewHref } from "../navigation/routes.js";
import type { EntryChangeReason } from "../review/component_types.js";
import type { ReviewResult } from "../review/types.js";

import { entryWording } from "./entry_wording.js";
import type { WorkspaceData } from "./workspace_data.js";
import { workspaceComparisonEvidence } from "./workspace_evidence_data.js";
import { propText } from "./workspace_props.js";
import {
  excludedStylesheets,
  retainedPaths,
} from "./workspace_style_evidence.js";
import { stylesheetEvidence } from "./workspace_stylesheet_evidence.js";
import { StylesheetEvidenceList } from "./workspace_stylesheet_list.js";

/** Comparison facts for the current entry and optional loaded comparison. */
export function WorkspaceEvidence({
  data,
  loaded,
  variantId,
}: {
  data: WorkspaceData;
  loaded?: ReviewResult;
  variantId?: string;
}) {
  const evidence = workspaceComparisonEvidence(data, variantId, loaded);
  const wording = entryWording(data.entry.kind);
  const hidden = data.status === undefined && !evidence.comparison;
  const stylesheets = stylesheetEvidence(
    evidence.reasons,
    data.entry.kind === "component"
      ? { kind: "component", componentId: evidence.componentId }
      : { kind: "screen" },
  );
  const excluded = excludedStylesheets(
    evidence.resourceViews,
    retainedPaths(evidence.reasons),
  );
  const savedView = data.variants.find((item) => item.value.id === variantId);
  const ignored = evidence.comparison
    ? [...new Set(evidence.views.flatMap((view) => view.ignoredIds))]
    : [];
  const variant =
    evidence.comparison && "variants" in evidence.comparison
      ? evidence.comparison.variants.find((item) => item.id === variantId)
      : undefined;
  return (
    <section
      className="mbk-comparison-evidence"
      data-workspace-evidence=""
      hidden={hidden}
    >
      {!hidden ? (
        <>
          <h3>Comparison details</h3>
          <p>Compared with the branch point on {data.base}.</p>
          {data.relatedComponents.map((component) => (
            <p key={component.id}>
              Changed component:{" "}
              <a href={viewHref("component", component.id)}>
                {component.title}
              </a>
            </p>
          ))}
          {data.inputChanges
            .filter((item) => item.variantId === variantId)
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
          {evidence.reasons.map((reason, index) => (
            <Reason key={`${reasonKey(reason)}/${index}`} reason={reason} />
          ))}
          {stylesheets.length ? (
            <StylesheetEvidenceList
              lead={wording.filesLead}
              stylesheets={stylesheets}
            />
          ) : null}
          {excluded.length ? (
            <>
              <p>
                {excluded.length === 1
                  ? wording.excludedStylesheet
                  : wording.excludedStylesheets}
              </p>
              <p>Examined and excluded:</p>
              <PathList paths={excluded} />
            </>
          ) : null}
          {ignored.length ? (
            <p>Excluded content: {ignored.join(", ")}.</p>
          ) : null}
          {evidence.comparison &&
          data.comparison &&
          !data.change &&
          data.relatedComponents.length > 0 &&
          evidence.views.some((view) => view.state === "changed") ? (
            <p>
              Shared component changes affect this preview. This page has no
              independent entry in Changes.
            </p>
          ) : null}
          {variant?.before &&
          variant.after &&
          JSON.stringify(variant.before.props) !==
            JSON.stringify(variant.after.props) ? (
            <>
              <h3>Saved props changed</h3>
              <p>Before</p>
              <pre>{propText(decodeProps(variant.before.props))}</pre>
              <p>Current</p>
              <pre>{propText(decodeProps(variant.after.props))}</pre>
            </>
          ) : null}
          {data.status === "Unmodified" &&
          (savedView?.status ?? "Unmodified") === "Unmodified" ? (
            <p>{wording.noChanges}</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function Reason({ reason }: { reason: EntryChangeReason }) {
  if (reason.kind === "dependency") return null;
  const labels = {
    added: "Added to this branch.",
    removed: "Removed on this branch.",
    material: "Rendered content changed.",
    inputs: "Supplied props or slots changed.",
    structure: "Component instances changed.",
    metadata: "Page details or saved examples changed.",
  } as const;
  return (
    <p>
      {reason.kind === "screen"
        ? `A screen in this flow changed: ${reason.id}`
        : labels[reason.kind]}
    </p>
  );
}

function PathList({ paths }: { paths: readonly string[] }) {
  return (
    <ul>
      {paths.map((path) => (
        <li key={path}>{path}</li>
      ))}
    </ul>
  );
}

function reasonKey(reason: EntryChangeReason): string {
  return reason.kind === "dependency"
    ? `${reason.kind}/${reason.path}`
    : reason.kind === "screen"
      ? `${reason.kind}/${reason.id}`
      : reason.kind;
}
