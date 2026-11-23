import { CircleCheck, Link } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { iconSize, iconStroke } from "../components/icons";

/**
 * The viewer's glyphs that the product's icon set has no name for: Share's
 * link in More, and the success glyph of the Mokly check, as the catalogue's
 * `docs/mockups/src/screens/product/viewer/glyphs.tsx` draws them. Each is
 * drawn exactly as the product's icons are, from the same family at one
 * stroke width in the inherited text colour, and assistive technology skips
 * it, because the label beside it names the action.
 */
function Glyph({ shape: Shape }: { shape: LucideIcon }) {
  return (
    <Shape
      size={iconSize.row}
      strokeWidth={iconStroke}
      color="currentColor"
      aria-hidden
    />
  );
}

/** Share's glyph: a link. */
export function ShareGlyph() {
  return <Glyph shape={Link} />;
}

/**
 * The success glyph of a check that concluded `success`: a tick in a circle,
 * which the check's sheet fills with the signal colour.
 */
export function SuccessGlyph() {
  return <Glyph shape={CircleCheck} />;
}
