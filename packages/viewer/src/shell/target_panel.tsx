/**
 * The right panel of a page, a Markdown document, a use case, or a removed
 * page or document. Inspect holds the entry's head. A use case adds its
 * Frames filter, which chooses one viewport and one scheme for every step,
 * and the Selection section. A page that the Changes filter lists has
 * Changes, which holds its comparison evidence; any other page keeps its
 * evidence in Inspect, after the head. An embedded root keeps the Dark
 * preview control of a document's one preview scheme in the head.
 */

import { ChangeStatus, type ChangeStatusValue } from "@mokly/ui/change-status";
import type { FramesToggleName } from "@mokly/ui/frames-filter";
import { IconButton } from "@mokly/ui/icon-control";
import { WorkspaceIcon } from "@mokly/ui/icons";
import { InspectPanel } from "@mokly/ui/inspect-panel";
import { InspectSelection } from "@mokly/ui/inspect-selection";
import { MetadataRow } from "@mokly/ui/metadata-row";

import type { CatalogueUseCase } from "@mokly/model";

import type { UseCaseFramesChoice } from "./canvas_use_case_frames.js";
import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { EntryInspectHead } from "./inspect_head.js";
import { UseCaseFrames } from "./inspect_frames.js";
import { PageEvidence } from "./page_evidence.js";
import type { PageComparisonEvidence } from "./page_evidence_data.js";
import { EntryRightPanel } from "./right_panel.js";
import { useShellStore } from "./store_context.js";
import type { RouteTarget } from "./target.js";

/** An embedded root's Dark preview control of a document's one scheme. */
function DarkPreview() {
  const store = useShellStore();
  const dark = store.state.selection.colorScheme === "dark";
  return (
    <MetadataRow label="Preview">
      <IconButton
        label="Dark preview"
        mark="data-workspace-scheme"
        onClick={() => store.selectColorScheme(dark ? "light" : "dark")}
        pressed={dark}
        title="Dark preview"
      >
        <WorkspaceIcon name="scheme" />
      </IconButton>
    </MetadataRow>
  );
}

/** Whether any step's screen has a dark view of the chosen viewport. */
function stepsHaveDark(
  catalogue: Catalogue,
  useCase: CatalogueUseCase,
  viewport: "desktop" | "mobile",
): boolean {
  return useCase.steps.some((step) =>
    catalogue.publicModel.screens
      .find((screen) => screen.path === step.screenPath)
      ?.views.some(
        (view) => view.viewport === viewport && view.colorScheme === "dark",
      ),
  );
}

export function TargetPanel({
  catalogue,
  context,
  page,
  status,
  target,
  useCase,
}: {
  catalogue: Catalogue;
  context: ShellContext;
  /** A current page's comparison facts. */
  page: PageComparisonEvidence | undefined;
  status: ChangeStatusValue | undefined;
  target: RouteTarget;
  /** A use case's own Frames choice, and how its filter changes it. */
  useCase?:
    | { choice: UseCaseFramesChoice; choose(name: FramesToggleName): void }
    | undefined;
}) {
  const store = useShellStore();
  const entry = target.entry;
  const listed = store.context.changedEntries?.includes(entry.path) === true;
  const evidence = page ? (
    <PageEvidence base={context.base} evidence={page} />
  ) : null;
  const changes = page && listed;
  return (
    <EntryRightPanel
      changes={changes ? evidence : undefined}
      inspect={
        <InspectPanel>
          <EntryInspectHead
            aside={
              entry.kind === "document" &&
              context.embedded &&
              catalogue.hasDarkFragments ? (
                <DarkPreview />
              ) : undefined
            }
            catalogue={catalogue}
            entry={entry}
            status={status ? <ChangeStatus status={status} /> : undefined}
          />
          {changes ? null : evidence}
          {entry.kind === "use-case" && useCase ? (
            <>
              <UseCaseFrames
                choice={useCase.choice}
                count={entry.steps.length}
                hasDark={stepsHaveDark(
                  catalogue,
                  entry,
                  useCase.choice.viewport,
                )}
                highlight={{
                  active: false,
                  available: false,
                  reason: "Component inspection is unavailable for this view.",
                }}
                onChoose={useCase.choose}
              />
              <InspectSelection selection={{ kind: "none" }} />
            </>
          ) : null}
        </InspectPanel>
      }
    />
  );
}
