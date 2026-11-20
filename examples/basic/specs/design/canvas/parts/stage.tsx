import { canvasFrame } from "../../library/canvas/canvas-frame.js";
import { CanvasGlyph } from "../../library/canvas/glyphs.js";
import { useDesignInstance } from "../../library/composition.js";
import { changeStatusBadge } from "../../library/controls/change-status.js";
import {
  DepictedViewScope,
  type DepictedView,
} from "../../parts/depicted_view.js";

import type { CanvasEntry } from "./entries.js";
import type { CanvasFrameSpec } from "./frames.js";

/** The entry's change status, as the section head and the entry bar show it. */
function EntryStatus({ entry, name }: { entry: CanvasEntry; name: string }) {
  const instance = useDesignInstance(name);
  return entry.status === undefined ? null : (
    <changeStatusBadge.Component
      moklyInstance={instance}
      status={entry.status}
    />
  );
}

/** The component kind tag beside a component's title. */
function KindTag({ entry }: { entry: CanvasEntry }) {
  return entry.kind === "component" ? (
    <span className="cv-kind-tag">
      <CanvasGlyph name="component" size={13} />
      Component
    </span>
  ) : null;
}

/**
 * The frame picker of the compact form: a native select of the entry's
 * frames over a drawn pill, which shows the picked frame in place.
 */
function FramePicker({
  frames,
  picked,
}: {
  frames: readonly CanvasFrameSpec[];
  picked: string;
}) {
  return (
    <label className="cv-frame-pick">
      <span
        aria-hidden="true"
        className="cv-frame-pick-glyph"
        data-glyph="mobile"
      >
        <CanvasGlyph name="mobile" size={13} />
      </span>
      <span
        aria-hidden="true"
        className="cv-frame-pick-glyph"
        data-glyph="desktop"
      >
        <CanvasGlyph name="desktop" size={13} />
      </span>
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
  /** Panned onto the first frame, as after zooming in; centred otherwise. */
  pan?: "start" | undefined;
  /** The frame that a screen's compact form picks. */
  picked?: string | undefined;
  /** The depicted view, whose regions the Highlight components switch reveals. */
  view?: DepictedView | undefined;
}

/**
 * The selected entry on the canvas: the section box with its head and its
 * frames at one zoom, and, for the compact form, the entry bar with the
 * title, the status, and a screen's frame picker.
 */
export function CanvasStage({
  entry,
  frames,
  pan,
  picked = "mobile-light",
  view,
  zoom,
}: CanvasStageProps) {
  const section = (
    <div className="cv-section" data-cv-kind={entry.kind}>
      <div className="cv-section-head">
        <span className="cv-title-tag">{entry.title}</span>
        <KindTag entry={entry} />
        <span className="cv-path-chip">{entry.path}</span>
        <EntryStatus entry={entry} name="section-status" />
      </div>
      <div className="cv-frames" data-cv-kind={entry.kind}>
        {frames.map((frame) => (
          <StageFrame entry={entry} frame={frame} key={frame.id} zoom={zoom} />
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
        </span>
        {entry.kind === "screen" ? (
          <FramePicker frames={frames} picked={picked} />
        ) : null}
      </div>
      <div className="cv-view" data-cv-pan={pan}>
        {view === undefined ? (
          section
        ) : (
          <DepictedViewScope view={view}>{section}</DepictedViewScope>
        )}
      </div>
    </>
  );
}

/** One frame of the stage, holding its sketch. */
function StageFrame({
  entry,
  frame,
  zoom,
}: {
  entry: CanvasEntry;
  frame: CanvasFrameSpec;
  zoom: number;
}) {
  return (
    <canvasFrame.Component
      moklyInstance={useDesignInstance(`frame-${frame.id}`)}
      kind={frame.kind}
      scheme={frame.scheme}
      label={frame.label}
      entry={entry.slug}
      width={frame.width}
      height={frame.height}
      zoom={zoom / 100}
    >
      {frame.content}
    </canvasFrame.Component>
  );
}
