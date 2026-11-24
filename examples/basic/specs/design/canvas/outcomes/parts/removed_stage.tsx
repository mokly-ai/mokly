import { useDesignInstance } from "../../../library/composition.js";
import { emptyState } from "../../../library/preview/empty-state.js";
import { useRenderedAppearance } from "../../../parts/appearance.js";
import { LoadingState } from "../../../parts/stage_content.js";
import { StageState } from "../../loading/parts/stage_state.js";
import type { CanvasEntry } from "../../parts/entries.js";
import type { CanvasFrameSpec } from "../../parts/frames.js";
import { EntryStatus } from "../../parts/stage.js";

/**
 * The quiet label after a removed entry's status. A removed document without
 * a dark render keeps its light version under Dark, and the label then says
 * so; under Light, nothing falls back, so the label says nothing more.
 */
export function usePreviousLabel(lightOnly = false): string {
  const dark = useRenderedAppearance() === "dark";
  return lightOnly && dark
    ? "Showing previous version — Light only"
    : "Showing previous version";
}

/** Whether a removed entry's previous version loads, or its request failed. */
export type PreviousStatus = "failed" | "loading";

/**
 * The shell's state after a previous version could not be loaded: its title,
 * its sentence, and Retry, which repeats the request. No artboard shows the
 * same entry loading again, so Retry is a picture of itself.
 */
function PreviousUnavailable() {
  return (
    <emptyState.Component
      moklyInstance={useDesignInstance("empty")}
      actionLabel="Retry"
      body="The previous version could not be loaded."
      title="Previous version unavailable"
    />
  );
}

/**
 * The compact entry bar of a removed page or document whose stage holds no
 * section: its title tag and its Removed status. A reading frame has no
 * frame picker.
 */
function DocumentEntryBar({ entry }: { entry: CanvasEntry }) {
  return (
    <div className="cv-entry-bar">
      <span className="cv-entry-title">
        <span className="cv-title-tag">{entry.title}</span>
        <EntryStatus entry={entry} name="entry-status" />
      </span>
    </div>
  );
}

/**
 * The canvas of a removed entry while its previous version loads, or after
 * its request failed: the shell's state in place of the section, in the
 * card of the home guidance. While it loads, one busy status line; after a
 * failure, the shell's title and sentence with Retry. The compact entry bar
 * keeps the Removed status, and a screen's frame picker lists its historical
 * views, which the catalogue index names.
 */
export function PreviousVersionState({
  entry,
  frames,
  status,
}: {
  entry: CanvasEntry;
  /** The historical frames that a screen's picker lists. */
  frames: readonly CanvasFrameSpec[];
  status: PreviousStatus;
}) {
  const state =
    status === "failed" ? (
      <PreviousUnavailable />
    ) : (
      <LoadingState status="Loading previous version…" />
    );
  return entry.kind === "document" ? (
    <>
      <DocumentEntryBar entry={entry} />
      <StageState state={status}>{state}</StageState>
    </>
  ) : (
    <StageState selected={{ entry, frames }} state={status}>
      {state}
    </StageState>
  );
}
