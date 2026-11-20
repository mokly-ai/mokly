import type { Viewport } from "@mokly/mokly";

import { MacWindowLinks } from "../mac-window";

import { StandalonePage } from "./standalone-page";

const path = "product/viewer/standalone/mac-app";

/**
 * The ready viewer in the Mac app. The window has no title bar, so its buttons
 * sit at the start of the viewer's top bar, and the cloud's slot content
 * starts after them. A wide window keeps the full bar. A narrow window keeps
 * the compact bar, because the window can be narrower than the breakpoint.
 */
export function ViewerStandaloneMacAppScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <>
      <StandalonePage
        viewport={viewport}
        state="default"
        screen={path}
        macApp
      />
      <MacWindowLinks current={path} />
    </>
  );
}
