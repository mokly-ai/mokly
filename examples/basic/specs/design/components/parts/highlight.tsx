import { mockLink } from "@mokly/mokly";

import {
  HighlightLabel,
  LabelLayer,
} from "../../../../../../packages/ui/src/highlight-label/highlight-label.js";
import {
  HighlightMask,
  type HighlightLength,
  type HighlightMaskPlacement,
} from "../../../../../../packages/ui/src/highlight-mask/highlight-mask.js";
import { useHighlightRegions } from "../../parts/depicted_view.js";
import { useCurrentPage } from "../../parts/design_navigation.js";
import type { ArtboardViewport } from "../../parts/shell.js";

/** The shipped mask fills the depicted document, below the labels. */
const FILL: HighlightMaskPlacement = {
  expanded: false,
  left: 0,
  position: "absolute",
  top: 0,
};

/** The shell draws each label this far above its instance's box. */
const LABEL_OFFSET = 22;

function labelTop(y: HighlightLength): HighlightLength {
  return typeof y === "number"
    ? y - LABEL_OFFSET
    : `calc(${y} - ${LABEL_OFFSET}px)`;
}

/**
 * The shell's highlight over one viewport's depicted document: the shipped
 * mask and labels of the regions in the depicted view's record, drawn from
 * fixed boxes. The Highlight components switch reveals the layer without a
 * script. A label whose instance has an artboard of its selection links to
 * it, and the others are pictures of the shell's label.
 */
export function HighlightLayer({ viewport }: { viewport: ArtboardViewport }) {
  const regions = useHighlightRegions(viewport);
  const current = useCurrentPage();
  if (!regions.length) return null;
  return (
    <div className="ce-highlight-layer">
      <HighlightMask
        boxes={regions.map((region) => region.box)}
        height="100%"
        placement={FILL}
        width="100%"
      />
      <div className="ce-highlight-labels">
        <LabelLayer placement="root">
          {regions.map((region) => (
            <HighlightLabel
              key={region.label}
              left={region.box.x}
              text={region.label}
              top={labelTop(region.box.y)}
              {...(region.to === undefined
                ? { interactive: false }
                : {
                    current: current(region.to) === "page",
                    href: mockLink(region.to),
                  })}
            />
          ))}
        </LabelLayer>
      </div>
    </div>
  );
}
