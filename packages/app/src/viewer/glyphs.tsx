import { Link } from "lucide-react-native";

import { iconSize, iconStroke } from "../components/icons";

/**
 * Share's glyph in More, a link: one of the viewer's glyphs that the
 * product's icon set has no name for, as the catalogue's
 * `docs/mockups/src/screens/product/viewer/glyphs.tsx` draws it. It is drawn
 * exactly as the product's icons are, from the same family at one stroke
 * width in the inherited text colour, and assistive technology skips it,
 * because the label beside it names the action.
 */
export function ShareGlyph() {
  return (
    <Link
      size={iconSize.row}
      strokeWidth={iconStroke}
      color="currentColor"
      aria-hidden
    />
  );
}
