import type { ReactNode } from "react";

import { useDesignInstance } from "../../../library/composition.js";
import { changeStatusBadge } from "../../../library/controls/change-status.js";
import type { CanvasEntry } from "../../parts/entries.js";
import type { CanvasFrameSpec } from "../../parts/frames.js";

import { ScreenFramePicker } from "./frame_picker.js";

/** What the canvas holds in place of a section, and why. */
export type StageStateKind = "failed" | "loading" | "missing";

/**
 * The compact entry bar of a screen whose stage holds no section: its title
 * tag, its change status, and the frame picker, which lists the screen's
 * frames.
 */
function EntryBar({
  entry,
  frames,
}: {
  entry: CanvasEntry;
  frames: readonly CanvasFrameSpec[];
}) {
  const status = useDesignInstance("entry-status");
  return (
    <div className="cv-entry-bar">
      <span className="cv-entry-title">
        <span className="cv-title-tag">{entry.title}</span>
        {entry.status === undefined ? null : (
          <changeStatusBadge.Component
            moklyInstance={status}
            status={entry.status}
          />
        )}
      </span>
      <ScreenFramePicker frames={frames} />
    </div>
  );
}

/** The selected screen of a stage state, and the frames that it shows. */
interface StageEntry {
  entry: CanvasEntry;
  frames: readonly CanvasFrameSpec[];
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
  /** The selected screen; none on a route that matches no entry. */
  selected?: StageEntry | undefined;
  state: StageStateKind;
}) {
  return (
    <>
      {selected === undefined ? null : (
        <EntryBar entry={selected.entry} frames={selected.frames} />
      )}
      <div className="cv-view" data-cv-state={state}>
        <div className="cv-home">{children}</div>
      </div>
    </>
  );
}
