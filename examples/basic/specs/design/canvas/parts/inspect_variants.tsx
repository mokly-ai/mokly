import { mockLink } from "@mokly/mokly";

import { useCurrentPage } from "../../parts/design_navigation.js";

import type { CanvasDestination } from "./destinations.js";
import { InspectSection } from "./inspect.js";

/** A saved variant in Inspect's list: the shown one, a link, or a picture. */
export interface InspectVariant {
  label: string;
  /** The variant is the shown one, or the one of the selected frame. */
  current?: boolean;
  /** The artboard that shows the variant chosen. */
  to?: CanvasDestination;
}

/** A variant's radio mark and its name. */
function VariantContent({ label }: { label: string }) {
  return (
    <>
      <span aria-hidden="true" className="cv-variant-mark" />
      {label}
    </>
  );
}

/**
 * One variant of the list. A static artboard runs no script, so a variant
 * links to the artboard that shows it chosen, current where that is the
 * rendered artboard, and is otherwise a picture of itself.
 */
function VariantRow({ variant }: { variant: InspectVariant }) {
  const page = useCurrentPage();
  if (variant.to === undefined)
    return (
      <li
        aria-current={variant.current ? "true" : undefined}
        className="cv-variant"
      >
        <VariantContent label={variant.label} />
      </li>
    );
  return (
    <li>
      <a
        aria-current={
          page(variant.to) ?? (variant.current ? "true" : undefined)
        }
        className="cv-variant"
        href={mockLink(variant.to)}
      >
        <VariantContent label={variant.label} />
      </a>
    </li>
  );
}

/**
 * The entry's saved variants as a radio list, with the shown variant
 * checked. On a variant set, choosing a variant selects its Light frame, and
 * the list checks the variant of the selected frame.
 */
export function InspectVariants({
  variants,
}: {
  variants: readonly InspectVariant[];
}) {
  return (
    <InspectSection count={variants.length} title="Variants">
      <ul className="cv-variants">
        {variants.map((variant) => (
          <VariantRow key={variant.label} variant={variant} />
        ))}
      </ul>
    </InspectSection>
  );
}
