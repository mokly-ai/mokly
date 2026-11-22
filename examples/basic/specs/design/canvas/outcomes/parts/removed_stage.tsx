import { useRenderedAppearance } from "../../../parts/appearance.js";
import { EmptyState, LoadingState } from "../../../parts/stage_content.js";
import { StageState } from "../../loading/parts/stage_state.js";
import type { CanvasDestination } from "../../parts/destinations.js";
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

/** A previous version that loads, or whose request failed, with its retry. */
export type PreviousRequest =
  { status: "loading" } | { status: "failed"; retry: CanvasDestination };

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
 * failure, the shell's title and sentence with Retry, which repeats the
 * request and opens the loading state. The compact entry bar keeps the
 * Removed status, and a screen's frame picker lists its historical views,
 * which the catalogue index names.
 */
export function PreviousVersionState({
  entry,
  frames,
  request,
}: {
  entry: CanvasEntry;
  /** The historical frames that a screen's picker lists. */
  frames: readonly CanvasFrameSpec[];
  request: PreviousRequest;
}) {
  const state =
    request.status === "failed" ? (
      <EmptyState
        body="The previous version could not be loaded."
        linkLabel="Retry"
        title="Previous version unavailable"
        to={request.retry}
      />
    ) : (
      <LoadingState status="Loading previous version…" />
    );
  return entry.kind === "document" ? (
    <>
      <DocumentEntryBar entry={entry} />
      <StageState state={request.status}>{state}</StageState>
    </>
  ) : (
    <StageState selected={{ entry, frames }} state={request.status}>
      {state}
    </StageState>
  );
}
