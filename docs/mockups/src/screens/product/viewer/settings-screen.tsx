import type { Viewport } from "@mokly/mokly";

import "../../../../styles/product/viewer-canvas-settings.css";
import { MembersPane } from "../settings/members-pane";

/** The drawing of the settings dialog's Canvas look over the viewer. */
export const viewerSettingsPath = "product/viewer/standalone/settings";

/**
 * The settings dialog over the viewer in Canvas, on the Members pane that
 * its rail opens. The account menu's Settings opens the dialog on its index,
 * because it names no pane; this drawing shows one pane so that the rail,
 * the pane and its controls show the look. The settings family's own pane
 * draws it, so `SettingsSurface` hosts it in the registered dialog over the
 * blank stage on desktop and in the registered layer on a phone, as every
 * settings screen does. The document lies under the viewer, so it takes the
 * Canvas palette, and this module's sheet draws the dialog and the layer in
 * Canvas.
 */
export function ViewerSettingsScreen({ viewport }: { viewport: Viewport }) {
  return (
    <MembersPane
      state="default"
      viewport={viewport}
      screen={viewerSettingsPath}
    />
  );
}
