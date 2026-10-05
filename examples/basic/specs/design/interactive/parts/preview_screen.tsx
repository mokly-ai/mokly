import { PreviewWorkspace } from "../../components/parts/workspace.js";
import { DetailsPanel } from "../../parts/details.js";
import { ExampleWorkspace } from "../../parts/example_workspace.js";
import { NavTree } from "../../parts/nav.js";
import { WelcomeHead } from "../../parts/screen_heads.js";
import { Shell, type ArtboardViewport } from "../../parts/shell.js";
import { BrowserFrame, PhoneFrame } from "../../parts/stage.js";

import { INTERACTIVE_PAGES } from "./destinations.js";

/** The preview states a selected screen fragment reaches. */
export type PreviewModeState = "live" | "static" | "preparing" | "unavailable";

const DESIGNS = {
  live: INTERACTIVE_PAGES.overview,
  static: INTERACTIVE_PAGES.static,
  preparing: INTERACTIVE_PAGES.preparing,
  unavailable: INTERACTIVE_PAGES.unavailable,
} as const;

/** The screen while its live preview is still being prepared. */
function PreparingPreview() {
  return (
    <div className="mbk-preview-state">
      <p className="mbk-preview-status" role="status">
        <span className="mbk-preview-spinner" aria-hidden="true" />
        Getting the live preview ready
      </p>
    </div>
  );
}

function PreparingWorkspace({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <PreviewWorkspace
      viewport={viewport}
      inspector={<DetailsPanel subject="welcome" />}
      render={(previewViewport) =>
        previewViewport === "mobile" ? (
          <PhoneFrame label="Mobile" small={viewport === "mobile"}>
            <PreparingPreview />
          </PhoneFrame>
        ) : (
          <BrowserFrame address="example.test/welcome" label="Desktop">
            <PreparingPreview />
          </BrowserFrame>
        )
      }
    />
  );
}

/**
 * One selected screen in each preview state. The artboard, device frames and
 * inspector stay the same in every state; only the toolbar selection and, while
 * the preview is being prepared, the framed content change.
 */
export function PreviewModeScreen({
  state,
  viewport,
}: {
  state: PreviewModeState;
  viewport: ArtboardViewport;
}) {
  return (
    <Shell
      design={DESIGNS[state]}
      viewport={viewport}
      nav={viewport === "desktop" ? <NavTree activeLabel="Welcome" /> : null}
    >
      <WelcomeHead active={viewport} />
      {state === "preparing" ? (
        <PreparingWorkspace viewport={viewport} />
      ) : (
        <ExampleWorkspace subject="welcome" viewport={viewport} />
      )}
    </Shell>
  );
}
