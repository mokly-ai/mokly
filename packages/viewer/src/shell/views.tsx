// Route-owned main-region rendering for the persistent Mokly shell: the
// home, missing-route, and target views, plus the title and
// active-route helpers the document scaffold and progressive navigation use.

import { sha256 } from "../data/sha256.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { DetailsPanel } from "./details.js";
import { DiffScreen } from "./diffs.js";
import {
  SchemeSwitch,
  ScreenHead,
  targetHead,
  ViewportSwitch,
} from "./head.js";
import { EmptyStage, TargetStage } from "./stages.js";
import type { RouteTarget } from "./target.js";
import { ComponentWorkspace } from "./workspace.js";

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
function HeadActions(props: { catalogue: Catalogue; target: RouteTarget }) {
  if (props.target.entry.kind === "page") {
    return null;
  }
  return (
    <>
      {props.target.entry.kind === "screen" ? <ViewportSwitch /> : null}
      {props.catalogue.hasDarkFragments ? <SchemeSwitch /> : null}
    </>
  );
}

function TargetView(props: {
  catalogue: Catalogue;
  fragment?: string;
  comparisons?: boolean;
  target: RouteTarget;
}) {
  const head = targetHead(props.catalogue, props.target);
  const target = props.target;
  const removed =
    target.kind === "entry" &&
    props.catalogue.removedEntries.some(
      ({ entry }) => entry.route === target.entry.route,
    );
  const stage = removed ? (
    <div className="mbk-empty" data-mokly-stage="" data-viewport="both">
      <h2>
        This {target.entry.kind === "page" ? "page" : "screen"} was removed
      </h2>
      {target.entry.kind === "page" ? (
        <p>This document is no longer in the catalogue.</p>
      ) : (
        <p>Select a comparison to see the previous screen.</p>
      )}
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
          <HeadActions catalogue={props.catalogue} target={props.target} />
        }
        crumbs={head.crumbs}
        heading={head.title}
        id={head.id}
      />
      {props.comparisons &&
      props.target.kind === "entry" &&
      props.target.entry.kind === "screen" ? (
        <DiffScreen route={props.target.entry.route}>{stage}</DiffScreen>
      ) : (
        stage
      )}
      <DetailsPanel catalogue={props.catalogue} target={props.target} />
    </>
  );
}

function HomeView(props: { catalogue: Catalogue }) {
  const entries = props.catalogue.manifest.entries;
  const screens = entries.filter((entry) => entry.kind === "screen").length;
  const components = entries.filter(
    (entry) => entry.kind === "component",
  ).length;
  const useCases = entries.filter((entry) => entry.kind === "use-case").length;
  const pages = entries.filter((entry) => entry.kind === "page").length;
  return (
    <EmptyStage heading="Mokly">
      <p>
        Browse the mockup catalogue: expand folders and choose an item from the
        navigation.
      </p>
      <p className="mbk-empty-note">
        {screens} screen{screens === 1 ? "" : "s"}
        {components
          ? ` · ${components} component${components === 1 ? "" : "s"}`
          : ""}{" "}
        · {useCases} user flow{useCases === 1 ? "" : "s"} · {pages} catalogue
        page
        {pages === 1 ? "" : "s"}
      </p>
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
export function activeRouteForView(view: ShellView): string | undefined {
  if (view.kind !== "target") {
    return undefined;
  }
  return view.target.entry.route;
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
  const route = activeRouteForView(props.view);
  const baseline = props.catalogue.removedEntries.find(
    ({ entry }) => entry.route === route,
  );
  return (
    <main
      className="mbk-main"
      data-mokly-view=""
      data-mokly-baseline={
        baseline ? sha256(JSON.stringify(baseline)) : undefined
      }
      id="mb-main"
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
          />
        ) : (
          <TargetView
            catalogue={props.catalogue}
            comparisons={props.context.comparisons ?? false}
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
