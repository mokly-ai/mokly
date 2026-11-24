import type { CSSProperties, ReactNode } from "react";

import { mockLink } from "@mokly/mokly";

import { CanvasGlyph } from "../../library/canvas/glyphs.js";
import { selection } from "../../library/canvas/selection.js";
import { useDesignInstance } from "../../library/composition.js";
import { useDesignNavigation } from "../../parts/design_navigation.js";

import { frameSize, type CanvasFrameSpec } from "./frames.js";
import {
  instanceSize,
  type CanvasInstance,
  type SketchBox,
} from "./instances.js";

/** The box of a selection over a frame, in the sketch's pixels. */
function SelectionPlace({
  box,
  children,
}: {
  box: SketchBox;
  children: ReactNode;
}) {
  const place: CSSProperties & Record<`--cv-sel-${string}`, number> = {
    "--cv-sel-x": box.x,
    "--cv-sel-y": box.y,
    "--cv-sel-w": box.width,
    "--cv-sel-h": box.height,
  };
  return (
    <div className="cv-sel-place" style={place}>
      {children}
    </div>
  );
}

/**
 * The selection of one instance over the frame it was picked on: the
 * registered selection, placed over the instance's box at the frame's scale.
 * The canvas is zoomed far enough for the padding to read, so the selection
 * draws its redline inside the instance's border.
 */
function StageSelection({ instance }: { instance: CanvasInstance }) {
  return (
    <SelectionPlace box={instance.box}>
      <selection.Component
        moklyInstance={useDesignInstance("selection")}
        name={instance.component}
        {...instanceSize(instance)}
        padding={instance.padding.left}
        border={instance.border.left}
      />
    </SelectionPlace>
  );
}

/** The overlays of a stage that shows one instance selected. */
export function selectionOverlays(instance: CanvasInstance) {
  return { [instance.frame.id]: <StageSelection instance={instance} /> };
}

/**
 * The selection of a whole frame: the registered selection's frame form over
 * the frame's document, with a handle at each corner and the frame's size in
 * whole pixels.
 */
function FrameSelection({ frame }: { frame: CanvasFrameSpec }) {
  const { height, width } = frame;
  return (
    <SelectionPlace box={{ x: 0, y: 0, width, height }}>
      <selection.Component
        moklyInstance={useDesignInstance("selection")}
        name={frame.label}
        {...frameSize(frame)}
        kind="frame"
      />
    </SelectionPlace>
  );
}

/** The overlays of a stage that shows one frame selected. */
export function frameSelectionOverlays(frame: CanvasFrameSpec) {
  return { [frame.id]: <FrameSelection frame={frame} /> };
}

/**
 * The pill above the phone's dock while an instance is selected: its
 * component, its first prop, and its padding, with a chevron. Like the dock's
 * current tab, it opens the panel sheet where an artboard shows the sheet
 * with the selection, and is a picture of itself otherwise.
 */
export function SelectionPill({ instance }: { instance: CanvasInstance }) {
  const to = useDesignNavigation().canvas?.panelSheet;
  const [first] = instance.props;
  // The spaces between the parts keep the pill's name in words; the flex
  // layout spaces them on screen.
  const content = (
    <>
      <span className="cv-pill-name">
        <CanvasGlyph name="component" size={12} />
        {instance.component}
      </span>{" "}
      <span className="cv-pill-props">
        {first === undefined ? null : (
          <>
            <span>
              <i>{first.name}</i> {first.value}
            </span>{" "}
          </>
        )}
        <span>
          <i>padding</i> {instance.padding.left}
        </span>
      </span>
      <CanvasGlyph name="chevron" size={14} />
    </>
  );
  return to === undefined ? (
    <span className="cv-pill">{content}</span>
  ) : (
    <a className="cv-pill" href={mockLink(to)}>
      {content}
    </a>
  );
}
