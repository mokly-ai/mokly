import type { ColorScheme, Viewport } from "@mokly/mokly";
import { BrowserFrame, PhoneFrame } from "@mokly/ui/device-frame";
import { PreviewFrame } from "@mokly/ui/preview-frame";

import { currentScreen } from "../../../fixtures/viewer-catalogue";
import { shownView } from "./published-view";
import { SampleScreen } from "./sample-screen";

/**
 * One viewport's frame on the stage: the package's preview frame around the
 * phone or the browser window, which holds the sample screen in the scheme of
 * the view that the frame shows, as `StageFrame` in the pinned
 * `@mokly/viewer` chooses it. `shownView` holds that choice and the frame's
 * Light only mark.
 */
export function PublishedFrame({
  viewport,
  colorScheme,
}: {
  viewport: Viewport;
  /** The scheme that the reader asked for, the document's own. */
  colorScheme: ColorScheme;
}) {
  const view = shownView(viewport, colorScheme);
  const screen = <SampleScreen viewport={viewport} scheme={view.scheme} />;
  return (
    <PreviewFrame
      fallback={view.fallback}
      placement={{ kind: "frame", viewport }}
      scheme={view.scheme}
    >
      {viewport === "mobile" ? (
        <PhoneFrame>{screen}</PhoneFrame>
      ) : (
        <BrowserFrame
          address={currentScreen.path + "/index.html"}
          interactive={false}
        >
          {screen}
        </BrowserFrame>
      )}
    </PreviewFrame>
  );
}
