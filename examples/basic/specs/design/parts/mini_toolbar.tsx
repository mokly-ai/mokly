import { HighlightLayer } from "../components/parts/highlight.js";

import { BUTTON_WIDTHS } from "./mini_action.js";
import { MiniToolbarCard } from "./mini_views.js";

/** The Toolbar's own example, or its saved variant Default. */
export type MiniToolbarVariant = "default" | "own";

/**
 * The props and the slot's text of the Toolbar's own example and of its
 * saved variant Default in `examples/basic/src/components/toolbar`: the own
 * example renders without slot content, and Default fills the slot with a
 * paragraph.
 */
export const TOOLBAR_EXAMPLES = {
  own: { title: "Workspace actions" },
  default: { title: "Workspace actions", text: "Choose where to continue." },
} as const satisfies Record<
  MiniToolbarVariant,
  { title: string; text?: string }
>;

/**
 * The measured boxes of the Toolbar's two Actions in its built component
 * document at the desktop size, from the document's top left corner: the
 * left edge and the width of each, 12px apart inside the card's 1px border
 * and 20px padding.
 */
export const TOOLBAR_ACTION_BOXES = {
  primary: { x: 45, width: BUTTON_WIDTHS["Browse details"] },
  secondary: { x: 199.11, width: BUTTON_WIDTHS["Browse welcome"] },
} as const;

/**
 * The top of the Toolbar's row of Actions in each example's document: below
 * the title, or below Default's paragraph.
 */
export const TOOLBAR_ACTIONS_TOP = {
  own: 72,
  default: 113,
} as const satisfies Record<MiniToolbarVariant, number>;

/**
 * Miniature depiction of the Toolbar's own example or of its saved variant
 * Default, as its component document renders it, in the measured layout of
 * the built document at the desktop size: the card 24px from the top left,
 * with its title, Default's paragraph, and the two Actions that it renders
 * at their measured boxes, and the highlight of the depicted view over it.
 * It reads the preview tokens, so a dark frame draws it on the dark screen.
 */
export function MiniToolbar({ variant }: { variant: MiniToolbarVariant }) {
  return (
    <div className="mbk-shot mbk-shot--toolbar">
      <div className="mbk-shot-pad">
        <MiniToolbarCard measured {...TOOLBAR_EXAMPLES[variant]} />
      </div>
      <HighlightLayer viewport="desktop" />
    </div>
  );
}
