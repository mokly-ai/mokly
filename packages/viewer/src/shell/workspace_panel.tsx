/**
 * The right panel of a screen's or a component's workspace. Inspect holds
 * the entry's head, its variants, the Frames filter, the canvas selection,
 * Props, Usage and Components. The entry has Changes while the Changes
 * filter lists it or its comparison is eligible, and a catalogue with
 * comparison data; the tab holds the stepper, the host's slot, the Compared
 * rail, the compare modes and the comparison details, which list each
 * compared frame's outcome and leave the branch point to the rail. An entry
 * without Changes keeps its comparison details in Inspect, after the head,
 * with the branch-point sentence.
 */

import type { ReactNode } from "react";

import { ChangeStatus } from "@mokly/ui/change-status";
import type { FramesToggleName } from "@mokly/ui/frames-filter";
import type { InspectSelectionState } from "@mokly/ui/inspect-selection";

import type { GeneratedComponentView } from "../components/views.js";

import type { CanvasFramePlan } from "./canvas_frames.js";
import type { Catalogue } from "./catalogue.js";
import { ChangesTab } from "./changes_tab.js";
import { useCompareModes } from "./compare_modes.js";
import type { ControlTarget } from "./control_values.js";
import type { DetailDelivery } from "./data_requests.js";
import type {
  FramesHighlightControl,
  FramesSectionModel,
} from "./inspect_frames.js";
import { EntryInspectHead } from "./inspect_head.js";
import { screenVariants, setVariants } from "./inspect_variants.js";
import type { RetryFocus } from "./retry_focus.js";
import { EntryRightPanel, shownPanelTab } from "./right_panel.js";
import { useShellStore } from "./store_context.js";
import type { ChangedView } from "./view_marks.js";
import type { EntryStatus } from "./view_status.js";
import type { WorkspaceComparison } from "./workspace_comparison.js";
import type { WorkspaceData } from "./workspace_data.js";
import { WorkspaceEvidence } from "./workspace_evidence.js";
import { WorkspaceInspect } from "./workspace_inspect.js";
import { WorkspaceInstances } from "./workspace_instances.js";
import { propsFieldCount, WorkspacePropsSection } from "./workspace_props.js";
import { WorkspaceUsage, usageRows } from "./workspace_usage.js";

/** What the workspace gives its right panel. */
export interface WorkspacePanelInput {
  catalogue: Catalogue;
  changedViews: readonly ChangedView[];
  /** Whether the Changes tab offers the entry's comparison. */
  changes: boolean;
  /** The compare on the canvas, whose modes and outcomes Changes shows. */
  compare: WorkspaceComparison;
  /** The edit form of the entry that Props edits. */
  controls: ReactNode;
  data: WorkspaceData;
  delivery: DetailDelivery;
  /** The evidence of a loaded comparison, which the details show. */
  compared: boolean;
  /** Whether the shown views' comparison is eligible. */
  eligible: boolean;
  frames: FramesSectionModel;
  highlight: FramesHighlightControl;
  instances: {
    /** The frame whose instances the Components section lists. */
    frame: CanvasFramePlan | undefined;
    focus(key: string): void;
    select(key: string): void;
    selectedKey: string | undefined;
    /** The view of the frame whose instances the section lists. */
    view: GeneratedComponentView | undefined;
  };
  onFrames(name: FramesToggleName, checked: boolean): void;
  previousPath: string | undefined;
  propsFocus: RetryFocus;
  /** Whether the entry is a removed screen, which shows its previous version. */
  removedScreen: boolean;
  /** The routed entry, which the head and the variants name. */
  routed: WorkspaceData["entry"];
  reveal: number;
  selection: InspectSelectionState;
  /** A variant set's row that Props edits, and how a reader chooses one. */
  set: { chosen: string | undefined; choose(path: string): void } | undefined;
  settled: boolean;
  status: EntryStatus | undefined;
  target: ControlTarget | undefined;
  variantPath: string | undefined;
}

/**
 * The comparison details of the entry. In the Changes tab they list each
 * compared frame's outcome and leave out the branch-point sentence, because
 * the Compared rail names the branch point.
 */
function Evidence({
  changes,
  input,
}: {
  changes: boolean;
  input: WorkspacePanelInput;
}) {
  return (
    <WorkspaceEvidence
      compared={input.compared}
      data={input.data}
      {...(changes ? { base: "", outcomes: input.compare.outcomes } : {})}
      {...(input.previousPath ? { previousPath: input.previousPath } : {})}
      {...(input.variantPath ? { variantPath: input.variantPath } : {})}
    />
  );
}

/** The number of consumers that Usage lists, where it lists any. */
function usageCount(input: WorkspacePanelInput): number | undefined {
  if (input.delivery.status !== "ready" || input.data.usageComplete === false)
    return undefined;
  const count =
    usageRows(input.data.usedBy).length + usageRows(input.data.affected).length;
  return count || undefined;
}

export function WorkspacePanel({ input }: { input: WorkspacePanelInput }) {
  const { data } = input;
  const store = useShellStore();
  const modes = useCompareModes({
    compare: input.compare,
    eligible: input.eligible,
    removedScreen: input.removedScreen,
    selected: shownPanelTab(store.state.panelTab, input.changes) === "changes",
    status: input.status,
  });
  const component = data.entry.kind === "component";
  const view = input.instances.view;
  const roots = view?.usage?.instances.filter(
    (instance) => instance.owner.kind === "entry",
  ).length;
  const composed = Boolean(view?.usage?.instances.length);
  return (
    <EntryRightPanel
      changes={
        input.changes ? (
          <ChangesTab
            details={<Evidence changes input={input} />}
            modes={modes}
            path={input.routed.path}
            status={input.status}
          />
        ) : undefined
      }
      inspect={
        <WorkspaceInspect
          model={{
            ...(component && !composed
              ? {}
              : {
                  components: {
                    body: (
                      <WorkspaceInstances
                        data={data}
                        onFocus={input.instances.focus}
                        onSelect={input.instances.select}
                        selectedKey={input.instances.selectedKey}
                        view={view}
                      />
                    ),
                    count: roots || undefined,
                    title: component ? "Nested components" : "Components",
                  },
                }),
            evidence: input.changes ? undefined : (
              <Evidence changes={false} input={input} />
            ),
            frames: input.frames,
            head: (
              <EntryInspectHead
                catalogue={input.catalogue}
                changedViews={input.changedViews}
                entry={input.routed}
                status={
                  <ChangeStatus
                    mark="data-workspace-status"
                    status={input.status}
                  />
                }
              />
            ),
            highlight: input.highlight,
            onFrames: input.onFrames,
            props: {
              body: (
                <WorkspacePropsSection
                  choose={input.set !== undefined && input.target === undefined}
                  controls={input.controls}
                  data={data}
                  delivery={input.delivery}
                  focus={input.propsFocus}
                  target={input.target}
                  unavailable={!component && view?.usage === undefined}
                />
              ),
              count: propsFieldCount(input.target),
            },
            removed: data.removed === true,
            reveal: input.reveal,
            selection: input.selection,
            usage: {
              body: <WorkspaceUsage data={data} delivery={input.delivery} />,
              count: usageCount(input),
            },
            variants: input.set
              ? setVariants(
                  input.catalogue,
                  data.variants,
                  input.set.chosen,
                  input.set.choose,
                )
              : screenVariants(input.catalogue, input.routed),
          }}
        />
      }
      settled={input.settled}
    />
  );
}
