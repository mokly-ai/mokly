// Route-owned main-region rendering for the persistent Mokly shell: the
// home, missing-route, and target views, plus the title and
// active-route helpers the document scaffold and progressive navigation use.

import { canonicalJson } from "../components/data.js";
import { sha256 } from "../data/sha256.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { DetailsPanel } from "./details.js";
import {
  SchemeSwitch,
  ScreenHead,
  targetHead,
  ViewportSwitch,
} from "./head.js";
import { homeSummary } from "./home_summary.js";
import { useShellIdentifier } from "./identifier_context.js";
import { PageEvidence } from "./page_evidence.js";
import { pageComparisonEvidence } from "./page_evidence_data.js";
import { removedPreviewData, RemovedPreviewStage } from "./previews.js";
import { EmptyStage, TargetStage } from "./stages.js";
import type { RouteTarget } from "./target.js";
import { ComponentWorkspace } from "./workspace.js";
import { workspaceKey } from "./workspace_entry.js";

/** One renderable Mokly shell state. */
export type ShellView =
  | { kind: "home" }
  | { kind: "missing"; requested: string }
  | { kind: "target"; target: RouteTarget };

/**
 * Head-band controls for a routed catalogue entry: the viewport switch for
 * screens, and the narrow-width home of the scheme switch, which the top bar
 * has no room for below the breakpoint.
 */
function HeadActions(props: {
  catalogue: Catalogue;
  embedded?: boolean;
  target: RouteTarget;
}) {
  if (props.target.entry.kind === "page") {
    return null;
  }
  return (
    <>
      {props.target.entry.kind === "screen" ? <ViewportSwitch /> : null}
      {props.embedded && props.catalogue.hasDarkFragments ? (
        <SchemeSwitch />
      ) : null}
    </>
  );
}

function TargetView(props: {
  catalogue: Catalogue;
  context: ShellContext;
  fragment?: string;
  target: RouteTarget;
}) {
  const head = targetHead(props.catalogue, props.target);
  const target = props.target;
  const removed =
    target.kind === "entry" &&
    props.catalogue.removedEntries.some(
      ({ entry }) => entry.path === target.entry.path,
    );
  const preview = removed
    ? removedPreviewData(props.catalogue, props.context, target.entry)
    : undefined;
  const page =
    target.entry.kind === "page" && !removed
      ? pageComparisonEvidence(
          props.catalogue,
          props.context,
          target.entry.path,
        )
      : undefined;
  const status = removed ? "Removed" : page?.status;
  const stage = preview ? (
    <RemovedPreviewStage data={preview} />
  ) : removed ? (
    <div className="mbk-empty" data-mokly-stage="" data-viewport="both">
      <h2>This user flow was removed</h2>
      <p>This flow is no longer in the catalogue.</p>
    </div>
  ) : (
    <TargetStage
      catalogue={props.catalogue}
      {...(props.fragment ? { fragment: props.fragment } : {})}
      target={props.target}
    />
  );
  return (
    <>
      <ScreenHead
        action={
          <HeadActions
            catalogue={props.catalogue}
            embedded={props.context.embedded ?? false}
            target={props.target}
          />
        }
        crumbs={head.crumbs}
        heading={head.title}
        path={head.path}
        status={
          status ? (
            <span className="mbk-entry-status" data-status={status}>
              {status}
            </span>
          ) : undefined
        }
      />
      {stage}
      <DetailsPanel catalogue={props.catalogue} target={props.target}>
        {page ? (
          <PageEvidence base={props.context.base} evidence={page} />
        ) : null}
      </DetailsPanel>
    </>
  );
}

function HomeView(props: { catalogue: Catalogue }) {
  const summary = homeSummary(props.catalogue.manifest.entries);
  return (
    <EmptyStage heading="Mokly">
      <p>
        Browse the mockup catalogue: expand folders and choose an item from the
        navigation.
      </p>
      {summary ? <p className="mbk-empty-note">{summary}</p> : null}
    </EmptyStage>
  );
}

function MissingView(props: { requested: string }) {
  return (
    <EmptyStage heading="Item not found">
      <p>
        Nothing in the catalogue matches <code>{props.requested}</code>. It may
        have been renamed or removed — choose another item from the navigation
        instead.
      </p>
      <p className="mbk-empty-note">
        If this item was just added, rebuild the catalogue with{" "}
        <code>mokly build</code>.
      </p>
      <a className="mbk-empty-link" href="/">
        Go to the catalogue home
      </a>
    </EmptyStage>
  );
}

/** The active catalogue route for a shell view, when it has one. */
function activeIdForView(view: ShellView): string | undefined {
  if (view.kind !== "target") {
    return undefined;
  }
  return view.target.entry.path;
}

/** The browser document title for a shell view. */
export function viewTitle(catalogue: Catalogue, view: ShellView): string {
  if (view.kind === "home") {
    return "Mokly";
  }
  if (view.kind === "missing") {
    return "Not found · Mokly";
  }
  return `${targetHead(catalogue, view.target).title} · Mokly`;
}

/** Render the only region replaced by client-side Browse navigation. */
export function ShellMain(props: {
  catalogue: Catalogue;
  context: ShellContext;
  view: ShellView;
}) {
  const mainId = useShellIdentifier("mb-main");
  const activeId = activeIdForView(props.view);
  const baseline = props.catalogue.removedEntries.find(
    ({ entry }) => entry.path === activeId,
  );
  return (
    <main
      className="mbk-main"
      data-mokly-view=""
      data-mokly-baseline={
        baseline ? sha256(canonicalJson(baseline)) : undefined
      }
      id={mainId}
      tabIndex={-1}
    >
      {props.view.kind === "home" ? (
        <HomeView catalogue={props.catalogue} />
      ) : null}
      {props.view.kind === "missing" ? (
        <MissingView requested={props.view.requested} />
      ) : null}
      {props.view.kind === "target" ? (
        props.view.target.kind === "entry" &&
        (props.view.target.entry.kind === "screen" ||
          props.view.target.entry.kind === "component") ? (
          <ComponentWorkspace
            catalogue={props.catalogue}
            context={props.context}
            entry={props.view.target.entry}
            key={workspaceKey(props.catalogue, props.view.target.entry)}
          />
        ) : (
          <TargetView
            catalogue={props.catalogue}
            context={props.context}
            {...(props.context.fragment
              ? { fragment: props.context.fragment }
              : {})}
            target={props.view.target}
          />
        )
      ) : null}
    </main>
  );
}
