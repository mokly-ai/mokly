// Route-owned main-region rendering for the persistent Mokly shell: the
// home, missing-route, and target views on the canvas, plus the title and
// active-route helpers the document scaffold and progressive navigation use.
// A target view's Inspect stands in the right panel, and the compact
// layout's entry bar names its entry over the canvas.

import { ChangeStatus } from "@mokly/ui/change-status";
import {
  HomeState,
  MissingRouteState,
  RemovedState,
} from "@mokly/ui/empty-state";
import { EntryBar } from "@mokly/ui/entry-bar";
import { MainRegion } from "@mokly/ui/shell-layout";

import { useCanvasLayout } from "./canvas_layout.js";
import { usePreviousVersionLabel } from "./canvas_removed_section.js";
import { useUseCasePick } from "./canvas_use_case_pick.js";
import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { targetHead } from "./head.js";
import { homeSummary } from "./home_summary.js";
import { useShellIdentifier } from "./identifier_context.js";
import { pageComparisonEvidence } from "./page_evidence_data.js";
import { removedPreviewData, RemovedPreviewStage } from "./previews.js";
import { publicEntryStatus } from "./public_workspace.js";
import { useRetryContent } from "./retry_focus.js";
import { useShellRoot } from "./root_context.js";
import { TargetStage } from "./stages.js";
import { useShellStore } from "./store_context.js";
import type { RouteTarget } from "./target.js";
import { TargetPanel } from "./target_panel.js";
import { useUseCaseChoice } from "./use_case_choice.js";
import { ComponentWorkspace } from "./workspace.js";
import { workspaceKey } from "./workspace_entry.js";

/** One renderable Mokly shell state. */
export type ShellView =
  | { kind: "home" }
  | { kind: "missing"; requested: string }
  | { kind: "target"; target: RouteTarget };

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
      ? pageComparisonEvidence(props.catalogue, target.entry.path)
      : undefined;
  const status = removed ? "Removed" : page?.status;
  const colorScheme = useShellStore().state.selection.colorScheme;
  // A use case keeps its own Frames choice. The compact layout shows one
  // step of a use case, which the entry bar's picker picks, and names a
  // removed entry's previous version while it shows.
  const [choice, choose] = useUseCaseChoice(
    target.entry.kind === "use-case" ? target.entry.path : undefined,
    useCanvasLayout(),
  );
  const useCase = useUseCasePick(
    props.catalogue,
    removed ? undefined : target.entry,
    choice,
  );
  const previous = usePreviousVersionLabel(preview, colorScheme);
  // The entry bar stands for the canvas section's head, which names a use
  // case's status too.
  const barStatus =
    target.entry.kind === "use-case" && !removed
      ? publicEntryStatus(target.entry)
      : status;
  const stage = preview ? (
    <RemovedPreviewStage data={preview} onShown={previous.onShown} />
  ) : removed ? (
    <RemovedState kind="flow" />
  ) : (
    <TargetStage
      catalogue={props.catalogue}
      {...(props.fragment ? { fragment: props.fragment } : {})}
      target={props.target}
      useCaseChoice={choice}
      useCaseStep={useCase?.picked}
    />
  );
  return (
    <>
      <EntryBar
        picker={useCase?.picker}
        quietLabel={previous.label}
        status={barStatus ? <ChangeStatus status={barStatus} /> : undefined}
        title={head.title}
      />
      {stage}
      <TargetPanel
        catalogue={props.catalogue}
        context={props.context}
        page={page}
        status={barStatus}
        target={props.target}
        useCase={removed ? undefined : { choice, choose }}
      />
    </>
  );
}

/** Render the only region replaced by client-side Browse navigation. */
export function ShellMain(props: {
  catalogue: Catalogue;
  context: ShellContext;
  view: ShellView;
}) {
  const elements = useShellRoot()?.elements;
  const mainId = useShellIdentifier("mb-main");
  // After a Try again of the catalogue, the main region takes focus.
  useRetryContent(elements?.main);
  return (
    <MainRegion id={mainId} ref={elements?.main}>
      {props.view.kind === "home" ? (
        <HomeState canvas summary={homeSummary(props.catalogue.publicModel)} />
      ) : null}
      {props.view.kind === "missing" ? (
        <MissingRouteState canvas requested={props.view.requested} />
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
    </MainRegion>
  );
}
