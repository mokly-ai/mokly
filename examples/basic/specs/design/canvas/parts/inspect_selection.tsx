import { mockLink } from "@mokly/mokly";

import { CanvasGlyph } from "../../library/canvas/glyphs.js";
import { useDesignInstance } from "../../library/composition.js";
import { boxModel } from "../../library/inspector/box-model.js";
import { MetaRow } from "../../parts/metadata_row.js";

import { SCHEMES, frameSize, type CanvasFrameSpec } from "./frames.js";
import { WrappingPath } from "./inspect.js";
import { contentSize, instanceSize, type CanvasInstance } from "./instances.js";

/**
 * The selected instance's component in a chip: a link to the Canvas artboard
 * that opens the component, as Open component does today, or else a picture
 * of the chip.
 */
function ComponentChip({ instance }: { instance: CanvasInstance }) {
  const name = (
    <>
      <CanvasGlyph name="component" size={12} />
      {instance.component}
    </>
  );
  return instance.componentPage === undefined ? (
    <span className="cv-ins-chip">{name}</span>
  ) : (
    <a className="cv-ins-chip" href={mockLink(instance.componentPage)}>
      {name}
    </a>
  );
}

/** The class of the Selection section, which the panel may open scrolled to. */
function sectionClass(initial: boolean | undefined): string {
  return initial ? "cv-sec cv-initial" : "cv-sec";
}

/**
 * The Selection section with an instance selected: its component and the
 * frame it was picked on, the props that the instance record holds, its
 * size, its box model, and its component's source file.
 */
export function InspectSelected({
  initial,
  instance,
}: {
  /** The panel opens scrolled to the Selection section. */
  initial?: boolean | undefined;
  instance: CanvasInstance;
}) {
  const size = instanceSize(instance);
  return (
    <section aria-label="Selection" className={sectionClass(initial)}>
      <h3 className="cv-sec-head">
        <ComponentChip instance={instance} />{" "}
        <span className="cv-sec-count">{instance.frame.label}</span>
      </h3>
      <dl className="cv-props">
        {instance.props.map((prop) => (
          <MetaRow
            key={prop.name}
            label={prop.name}
            name={`prop-${prop.name}`}
            presentation="props"
          >
            <code className="cv-value">{prop.value}</code>
          </MetaRow>
        ))}
        <MetaRow label="Size" name="size" presentation="props">
          <code className="cv-value">
            {size.width} × {size.height}
          </code>
        </MetaRow>
      </dl>
      <boxModel.Component
        moklyInstance={useDesignInstance("box-model")}
        top={instance.padding.top}
        right={instance.padding.right}
        bottom={instance.padding.bottom}
        left={instance.padding.left}
        {...contentSize(instance)}
      />
      <p className="cv-source">
        <CanvasGlyph name="document" size={13} />
        <span>
          <WrappingPath path={instance.source} />
        </span>
      </p>
    </section>
  );
}

/**
 * The Selection section with a frame of a variant set selected: a Frame chip
 * with the frame's size in whole pixels, and the variant and the scheme that
 * the frame shows.
 */
export function InspectFrameSelected({
  frame,
  initial,
  variant,
}: {
  frame: CanvasFrameSpec;
  /** The panel opens scrolled to the Selection section. */
  initial?: boolean | undefined;
  /** The title of the saved variant that the frame shows. */
  variant: string;
}) {
  const size = frameSize(frame);
  return (
    <section aria-label="Selection" className={sectionClass(initial)}>
      <h3 className="cv-sec-head">
        <span className="cv-ins-chip">
          <CanvasGlyph name="frame" size={12} />
          Frame
        </span>{" "}
        <span className="cv-sec-count">
          {size.width} × {size.height}
        </span>
      </h3>
      <dl className="cv-props">
        <MetaRow label="Variant" name="frame-variant" presentation="props">
          {variant}
        </MetaRow>
        <MetaRow label="Scheme" name="frame-scheme" presentation="props">
          {SCHEMES[frame.scheme]}
        </MetaRow>
      </dl>
    </section>
  );
}
