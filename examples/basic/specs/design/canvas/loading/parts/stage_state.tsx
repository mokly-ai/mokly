import type { ReactNode } from "react";

import { CanvasGlyph } from "../../../library/canvas/glyphs.js";
import { useDesignInstance } from "../../../library/composition.js";
import { changeStatusBadge } from "../../../library/controls/change-status.js";
import { EmptyState, LoadingState } from "../../../parts/stage_content.js";
import type { CanvasEntry, CanvasEntryKind } from "../../parts/entries.js";
import type { CanvasFrameSpec } from "../../parts/frames.js";
import { FramePicker } from "../../parts/stage.js";

import type { PendingDetails } from "./details.js";

/** What the canvas holds in place of a section, and why. */
export type StageStateKind = "failed" | "loading" | "missing";

/** The selected entry of a stage state, and the frames that it shows. */
interface StageEntry {
  entry: CanvasEntry;
  frames: readonly CanvasFrameSpec[];
  /**
   * The frame that the picker shows: a screen's Mobile · Light by default,
   * or the selected frame of a variant set.
   */
  picked?: string | undefined;
}

/** A component's kind tag beside its title, as the stage's entry bar draws it. */
function ComponentTag() {
  return (
    <span className="cv-kind-tag">
      <CanvasGlyph name="component" size={13} />
      Component
    </span>
  );
}

/**
 * The compact entry bar of an entry whose stage holds no section: its title
 * tag, a component's kind tag, its change status, and the stage's frame
 * picker, which lists the entry's frames and opens on the picked frame. The
 * catalogue index names the entry's views, so the picker lists them before
 * the entry's detail arrives.
 */
function EntryBar({ entry, frames, picked = "mobile-light" }: StageEntry) {
  const status = useDesignInstance("entry-status");
  return (
    <div className="cv-entry-bar">
      <span className="cv-entry-title">
        <span className="cv-title-tag">{entry.title}</span>
        {entry.kind === "component" ? <ComponentTag /> : null}
        {entry.status === undefined ? null : (
          <changeStatusBadge.Component
            moklyInstance={status}
            status={entry.status}
          />
        )}
      </span>
      <FramePicker frames={frames} kind={entry.kind} picked={picked} />
    </div>
  );
}

/**
 * The canvas while it holds no section: the stage of an entry whose detail
 * loads or failed, or a route that matches no entry. The state stands on the
 * stage in the card of the home guidance. An entry's state keeps the compact
 * entry bar, which names the entry and picks its frame while the panel sheet
 * is closed.
 */
export function StageState({
  children,
  selected,
  state,
}: {
  children: ReactNode;
  /** The selected entry; none on a route that matches no entry. */
  selected?: StageEntry | undefined;
  state: StageStateKind;
}) {
  return (
    <>
      {selected === undefined ? null : <EntryBar {...selected} />}
      <div className="cv-view" data-cv-state={state}>
        <div className="cv-home">{children}</div>
      </div>
    </>
  );
}

/** What the stage's failure title calls each kind of entry, as the shell does. */
const NOUNS = {
  component: "component",
  document: "document",
  screen: "screen",
} as const satisfies Record<CanvasEntryKind, string>;

/**
 * The stage of a selected entry until all its route details arrive: the
 * compact entry bar, and in place of the section the shipped state of the
 * details. While they load, one busy status line; once one failed, the title
 * that names the entry's kind, with Try again, which loads them again.
 */
export function DetailsStage({
  details,
  ...selected
}: StageEntry & { details: PendingDetails }) {
  return (
    <StageState selected={selected} state={details.status}>
      {details.status === "failed" ? (
        <EmptyState
          body="The catalogue is still available while you try again."
          linkLabel="Try again"
          title={`This ${NOUNS[selected.entry.kind]} could not be shown`}
          to={details.retry}
        />
      ) : (
        <LoadingState status="Loading preview…" />
      )}
    </StageState>
  );
}
