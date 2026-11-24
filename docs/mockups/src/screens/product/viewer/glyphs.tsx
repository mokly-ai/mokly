import { CircleCheck, Link } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { iconSize, iconStroke } from "../icons";

/**
 * The viewer's glyphs that the product's icon set has no name for: Share's
 * link in More, and the success glyph of the Mokly check. Each is drawn
 * exactly as the product's icons are, from the same family at one stroke
 * width in the inherited text colour, and assistive technology skips it,
 * because the label beside it names the action.
 */
function Glyph({ shape: Shape, size }: { shape: LucideIcon; size: number }) {
  return (
    <Shape
      size={size}
      strokeWidth={iconStroke}
      color="currentColor"
      aria-hidden
    />
  );
}

/** Share's glyph: a link. */
export function ShareGlyph({ size = iconSize.row }: { size?: number }) {
  return <Glyph shape={Link} size={size} />;
}

/**
 * The success glyph of a check that concluded `success`: a tick in a circle,
 * which the check's sheet fills with the signal colour.
 */
export function SuccessGlyph({ size = iconSize.row }: { size?: number }) {
  return <Glyph shape={CircleCheck} size={size} />;
}
