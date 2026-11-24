import type { ReactNode } from "react";

import { canvasFrame } from "../../library/canvas/canvas-frame.js";
import { CanvasGlyph } from "../../library/canvas/glyphs.js";
import { optional, useDesignInstance } from "../../library/composition.js";
import { changeStatusBadge } from "../../library/controls/change-status.js";
import type { CompareModesProps } from "../../library/panels/compare-modes.js";
import { useRenderedAppearance } from "../../parts/appearance.js";
import {
  DepictedViewScope,
  type DepictedView,
} from "../../parts/depicted_view.js";

import type { CanvasEntry } from "./entries.js";
import { stageTags, type CanvasFrameSpec } from "./frames.js";
import { openingFrame, pickerFrames } from "./picked_frames.js";

/** A compare mode of the Changes tab. */
type CompareMode = CompareModesProps["mode"];

/**
 * The entry's change status, as the section head and the entry bar show it,
 * also the entry bar of a stage that holds no section.
 */
export function EntryStatus({
  entry,
  name,
}: {
  entry: CanvasEntry;
  name: string;
}) {
  const instance = useDesignInstance(name);
  return entry.status === undefined ? null : (
    <changeStatusBadge.Component
      moklyInstance={instance}
      status={entry.status}
    />
  );
}

/**
 * The component kind tag beside a component's title, in the section head and
 * the entry bar, also the entry bar of a stage that holds no section.
 */
export function KindTag({ entry }: { entry: CanvasEntry }) {
  return entry.kind === "component" ? (
    <span className="cv-kind-tag">
      <CanvasGlyph name="component" size={13} />
      Component
    </span>
  ) : null;
}

/** A glyph of the frame picker, which the picked frame's kind shows. */
function PickerGlyph({ glyph }: { glyph: "component" | "desktop" | "mobile" }) {
  return (
    <span aria-hidden="true" className="cv-frame-pick-glyph" data-glyph={glyph}>
      <CanvasGlyph name={glyph} size={13} />
    </span>
  );
}

/**
 * The frame picker of the compact form: a native select of the entry's
 * frames over a drawn pill, which shows the picked frame in place, with the
 * picked screen frame's viewport glyph, or a variant set's component glyph.
 * A use case's picker lists its steps, one shown frame each.
 */
export function FramePicker({
  frames,
  kind,
  picked,
}: {
  frames: readonly Pick<CanvasFrameSpec, "id" | "label">[];
  kind: CanvasEntry["kind"];
  picked: string;
}) {
  return (
    <label className="cv-frame-pick">
      {kind === "component" ? (
        <PickerGlyph glyph="component" />
      ) : (
        <>
          <PickerGlyph glyph="mobile" />
          <PickerGlyph glyph="desktop" />
        </>
      )}
      <select aria-label="Frame" data-cv-frame-pick="" defaultValue={picked}>
        {frames.map((frame) => (
          <option key={frame.id} value={frame.id}>
            {frame.label}
          </option>
        ))}
      </select>
      <CanvasGlyph name="chevron" size={14} />
    </label>
  );
}

interface CanvasStageProps {
  entry: CanvasEntry;
  frames: readonly CanvasFrameSpec[];
  /** The stage's zoom in percent, as the zoom pill shows it. */
  zoom: number;
  /**
   * Panned onto the first frame, as after zooming in, or onto the end of the
   * first row, Mobile · Light, as after selecting on it; centred otherwise.
   */
  pan?: "end" | "start" | undefined;
  /**
   * The frame that the compact form picks: by default, the frame that holds
   * the selection, else the frame that a screen opens on, its Mobile frame
   * in the scheme that the artboard renders in. A variant set shows its
   * picked frame alone with the frame picker, and the whole set without one.
   */
  picked?: string | undefined;
  /**
   * The frame that holds the selection, a selected instance's frame or a
   * selected frame, whose label takes the signal.
   */
  selected?: string | undefined;
  /**
   * The frames that the compact frame picker lists, every frame by default,
   * in the shell's order: a screen's Mobile frames first.
   */
  pickable?: readonly CanvasFrameSpec[] | undefined;
  /** What lies over a frame, by the frame's id, such as the selection. */
  overlays?: Readonly<Record<string, ReactNode>> | undefined;
  /** The depicted view, whose regions the Highlight components switch reveals. */
  view?: DepictedView | undefined;
  /**
   * The compare mode of the Changes tab. In Side by side, the stage shows
   * the picked frame's two versions, and the compact frame picker picks
   * another frame's pair in place.
   */
  compare?: CompareMode | undefined;
  /**
   * A removed entry's quiet label after its status, such as `Showing
   * previous version`, in the section head and the compact entry bar.
   */
  previous?: ReactNode;
}

/**
 * The selected entry on the canvas: the section box with its head and its
 * frames at one zoom, and, for the compact form, the entry bar with the
 * title, the status, and the frame picker of a screen, or of a variant set
 * with a frame picked. A depicted view that the shell highlights shows its
 * highlight also where no switch is drawn, as in the compact form while the
 * panel sheet is closed. Below 60%, the frames draw no tags: the highlight
 * keeps its outlines and cutouts without its labels.
 */
export function CanvasStage({
  compare,
  entry,
  frames,
  overlays = {},
  pan,
  pickable = frames,
  picked: pick,
  previous,
  selected,
  view,
  zoom,
}: CanvasStageProps) {
  const scheme = useRenderedAppearance();
  const picked =
    pick ??
    selected ??
    (entry.kind === "screen" ? openingFrame(pickable, scheme) : undefined);
  const label =
    previous === undefined ? null : (
      <span className="cv-previous-label">{previous}</span>
    );
  const section = (
    <div className="cv-section" data-cv-kind={entry.kind}>
      <div className="cv-section-head">
        <span className="cv-title-tag">{entry.title}</span>
        <KindTag entry={entry} />
        <span className="cv-path-chip">{entry.path}</span>
        <EntryStatus entry={entry} name="section-status" />
        {label}
      </div>
      <div
        className="cv-frames"
        data-cv-chosen={compare === "side-by-side" ? picked : undefined}
        data-cv-compare={compare}
        data-cv-kind={entry.kind}
      >
        {frames.map((frame) => (
          <StageFrame
            entry={entry}
            frame={frame}
            key={frame.id}
            overlay={overlays[frame.id]}
            selected={frame.id === selected}
            zoom={zoom}
          />
        ))}
      </div>
    </div>
  );
  return (
    <>
      <div className="cv-entry-bar">
        <span className="cv-entry-title">
          <span className="cv-title-tag">{entry.title}</span>
          <KindTag entry={entry} />
          <EntryStatus entry={entry} name="entry-status" />
          {label}
        </span>
        {picked === undefined || entry.kind === "document" ? null : (
          <FramePicker
            frames={pickerFrames(pickable)}
            kind={entry.kind}
            picked={picked}
          />
        )}
      </div>
      <div
        className="cv-view"
        data-cv-highlight={view?.highlight === "on" ? "on" : undefined}
        data-cv-pan={pan}
        data-cv-tags={stageTags(zoom)}
      >
        {view === undefined ? (
          section
        ) : (
          <DepictedViewScope view={view}>{section}</DepictedViewScope>
        )}
      </div>
    </>
  );
}

/**
 * One frame of the stage, holding its sketch and what lies over it, in a
 * slot that draws no box of its own. The Frames filter hides the slot, so a
 * frame that the filter turns off stays hidden whatever rule shows the
 * frame, such as the compact frame picker's.
 */
function StageFrame({
  entry,
  frame,
  overlay,
  selected,
  zoom,
}: {
  entry: CanvasEntry;
  frame: CanvasFrameSpec;
  overlay: ReactNode;
  selected: boolean;
  zoom: number;
}) {
  const viewport =
    frame.kind === "desktop" || frame.kind === "mobile"
      ? frame.kind
      : undefined;
  return (
    <div
      className="cv-frame-slot"
      data-cv-scheme={frame.scheme}
      data-cv-viewport={viewport}
    >
      <canvasFrame.Component
        moklyInstance={useDesignInstance(`frame-${frame.id}`)}
        kind={frame.kind}
        scheme={frame.scheme}
        label={frame.label}
        entry={entry.slug}
        width={frame.width}
        height={frame.height}
        zoom={zoom / 100}
        {...optional("compare", frame.compare)}
        {...optional("side", frame.side)}
        {...optional("before", frame.before)}
        {...optional("variant", frame.variant)}
        {...(frame.lightOnly ? { lightOnly: true } : {})}
        {...(selected ? { selected } : {})}
        {...optional("overlay", overlay ?? undefined)}
      >
        {frame.content}
      </canvasFrame.Component>
    </div>
  );
}
