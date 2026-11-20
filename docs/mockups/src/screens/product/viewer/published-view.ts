import type { ColorScheme, Viewport } from "@mokly/mokly";
import type { ChangeStatusValue } from "@mokly/ui/change-status";

import {
  currentScreen,
  viewerCatalogue,
} from "../../../fixtures/viewer-catalogue";

/**
 * The view of the current screen that one viewport shows, and what the
 * workspace says about it.
 */
export interface ShownView {
  /** The view's scheme, which the frame, its device and the sample follow. */
  scheme: ColorScheme;
  /**
   * Whether the viewport has no dark view in a catalogue that has dark views.
   * The package's stylesheet then names the light view Light only while the
   * shell is Dark.
   */
  fallback: boolean;
  /** The status beside the title. */
  status: ChangeStatusValue;
  /** Whether the comparison band shows. */
  eligible: boolean;
  /** Whether each view control carries its change mark. */
  marks: { viewport: boolean; scheme: boolean };
}

/**
 * The view of the current screen that `viewport` shows for the scheme the
 * reader asked for, as the pinned `@mokly/viewer` resolves it, with the
 * status, the comparison band and the view controls' marks that its workspace
 * derives from that view. The drawing follows the public rule of Screen
 * controls in `docs/protocol/mokly-changes-controls.md` of the pinned
 * `@mokly/mokly`:
 *
 * - Under Dark a viewport shows its dark view, or keeps its light view when it
 *   has none, and under Light its light view. Mokly gives every screen a
 *   light view.
 * - The status and the band describe the view actually shown, not the whole
 *   entry: a changed view is Changed and has the band, and another view is
 *   Unmodified without it.
 * - The theme control is marked when a changed view uses the other scheme,
 *   and the viewport control when a changed view uses the other viewport.
 *   A document draws one viewport, so the rule's Both, which is never marked,
 *   does not arise.
 *
 * Every view of the fixture records its change, so the rule's fallback to the
 * entry's own status, for views without that evidence, does not arise either.
 */
export function shownView(
  viewport: Viewport,
  requested: ColorScheme,
): ShownView {
  const hasDark = currentScreen.views.some(
    (view) => view.viewport === viewport && view.scheme === "dark",
  );
  const scheme = requested === "dark" && hasDark ? "dark" : "light";
  const changed = currentScreen.views.filter(
    ({ change }) => change === "changed",
  );
  const shownChanged = changed.some(
    (view) => view.viewport === viewport && view.scheme === scheme,
  );
  return {
    scheme,
    fallback: viewerCatalogue.hasDarkViews && !hasDark,
    status: shownChanged ? "Changed" : "Unmodified",
    eligible: shownChanged,
    marks: {
      viewport: changed.some((view) => view.viewport !== viewport),
      scheme: changed.some((view) => view.scheme !== scheme),
    },
  };
}
