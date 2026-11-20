import type { CSSProperties } from "react";

import { mockLink } from "@mokly/mokly";

import { CanvasGlyph } from "../../library/canvas/glyphs.js";
import { selection } from "../../library/canvas/selection.js";
import { useDesignInstance } from "../../library/composition.js";
import { useDesignNavigation } from "../../parts/design_navigation.js";

import {
  SELECTION_FRAME,
  instanceSize,
  type WelcomeInstance,
} from "./welcome_instances.js";

/**
 * The selection of one instance over the frame it was picked on: the
 * registered selection, placed over the instance's box at the frame's scale.
 * The canvas is zoomed far enough for the padding to read, so the selection
 * draws its redline.
 */
function StageSelection({ instance }: { instance: WelcomeInstance }) {
  const { box } = instance;
  const place: CSSProperties & Record<`--cv-sel-${string}`, number> = {
    "--cv-sel-x": box.x,
    "--cv-sel-y": box.y,
    "--cv-sel-w": box.width,
    "--cv-sel-h": box.height,
  };
  return (
    <div className="cv-sel-place" style={place}>
      <selection.Component
        moklyInstance={useDesignInstance("selection")}
        name={instance.component}
        {...instanceSize(instance)}
        padding={instance.padding.left}
      />
    </div>
  );
}

/** The overlays of a stage that shows one instance selected. */
export function selectionOverlays(instance: WelcomeInstance) {
  return { [SELECTION_FRAME.id]: <StageSelection instance={instance} /> };
}

/**
 * The pill above the phone's dock while an instance is selected: its
 * component, its first prop, and its padding, with a chevron. Like the dock's
 * current tab, it opens the panel sheet where an artboard shows the sheet
 * with the selection, and is a picture of itself otherwise.
 */
export function SelectionPill({ instance }: { instance: WelcomeInstance }) {
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
