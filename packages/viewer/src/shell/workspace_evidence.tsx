/** Factual comparison evidence rendered only in the Details inspector panel. */

import { Fragment } from "react";

import { decodeProps } from "../components/codec.js";
import type { EntryChangeReason } from "../review/component_types.js";
import type { ReviewResult } from "../review/types.js";

import { entryWording } from "./entry_wording.js";
import type { WorkspaceData } from "./workspace_data.js";
import { workspaceComparisonEvidence } from "./workspace_evidence_data.js";
import { propText } from "./workspace_props.js";
import {
  excludedStylesheets,
  retainedPaths,
  styleOutcomeLead,
  styleOutcomes,
} from "./workspace_style_evidence.js";

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
  const hidden = data.status === undefined && !evidence.comparison;
  const reasonPaths = retainedPaths(evidence.reasons);
  const excluded = excludedStylesheets(evidence.resourceViews, reasonPaths);
  const retained = [...new Set([...reasonPaths, ...evidence.sharedImpact])]
    .filter((path) => !excluded.includes(path))
    .sort();
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
            <p key={component.route}>
              Changed component:{" "}
              <a href={`/view/${encodeRoute(component.route)}`}>
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
          {retained.length ? (
            <>
              <p>Changes to these files may affect this screen:</p>
              <PathList paths={retained} />
            </>
          ) : null}
          {styleOutcomes(evidence.reasons).map((outcome) => (
            <Fragment key={outcome.status}>
              <p>{styleOutcomeLead(outcome)}</p>
              {outcome.selectors.length ? (
                <ul>
                  {outcome.selectors.map((selector) => (
                    <li key={selector}>
                      <code className="mbk-code">{selector}</code>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Fragment>
          ))}
          {excluded.length ? (
            <>
              <p>
                {excluded.length === 1
                  ? "This stylesheet changed, but none of the changed styles apply to this screen."
                  : "These stylesheets changed, but none of the changed styles apply to this screen."}
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
          {data.status === "Unmodified" ? (
            <p>{entryWording(data.entry.kind).noChanges}</p>
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
        ? `A screen in this flow changed: ${reason.route}`
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
      ? `${reason.kind}/${reason.route}`
      : reason.kind;
}

function encodeRoute(route: string): string {
  return route.split("/").map(encodeURIComponent).join("/");
}
