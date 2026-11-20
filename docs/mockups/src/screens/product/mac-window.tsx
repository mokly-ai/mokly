import { MockLink } from "@mokly/mokly";

import { CatalogueLinks } from "../../components/catalogue-links";
import { WindowControls } from "../../entries/design/window-controls.mockup";

/**
 * The class that a screen root takes when it draws the Mac app window. It
 * gives every top bar the width that the window buttons take, as the window
 * reports it to the app.
 */
export const macWindowClass = "fo-mac-window";

/**
 * The native buttons over the start of the Mac app window. A screen draws them
 * once, above everything on the page, because macOS draws them above the page.
 */
export function MacWindowControls() {
  return (
    <span className="fo-mac-window-controls">
      <WindowControls focus="focused" />
    </span>
  );
}

const macDrawings = [
  { path: "product/viewer/standalone/mac-app", label: "Viewer in the Mac app" },
  { path: "product/account/sign-in/mac-app", label: "Sign in in the Mac app" },
  {
    path: "product/settings/sections/mac-app",
    label: "Settings in the Mac app",
  },
] as const;

/** Links below a Mac drawing to the other Mac drawings. */
export function MacWindowLinks({ current }: { current: string }) {
  return (
    <CatalogueLinks>
      {macDrawings
        .filter((drawing) => drawing.path !== current)
        .map((drawing) => (
          <MockLink key={drawing.path} to={drawing.path}>
            {drawing.label}
          </MockLink>
        ))}
    </CatalogueLinks>
  );
}
