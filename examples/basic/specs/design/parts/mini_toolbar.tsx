import { HighlightLayer } from "../components/parts/highlight.js";

import { MiniToolbarCard, type MiniToolbarContent } from "./mini_views.js";

/**
 * The props and the slot's text of the Toolbar's saved variant Default in
 * `examples/basic/src/components/toolbar`.
 */
export const TOOLBAR_DEFAULT = {
  title: "Workspace actions",
  text: "Choose where to continue.",
} as const satisfies MiniToolbarContent;

/**
 * Miniature depiction of the Toolbar's saved variant Default, as its
 * component document renders it: the Toolbar 24px from the top left, with
 * its title, the slot's text, and the two Actions that it renders, and the
 * highlight of the depicted view over it. It reads the preview tokens, so a
 * dark frame draws it on the dark screen.
 */
export function MiniToolbar() {
  return (
    <div className="mbk-shot mbk-shot--toolbar">
      <div className="mbk-shot-pad">
        <MiniToolbarCard {...TOOLBAR_DEFAULT} />
      </div>
      <HighlightLayer viewport="desktop" />
    </div>
  );
}
