import type { ReactNode } from "react";

import { PreviewWorkspace } from "../components/parts/workspace.js";

import { useDarkPreview } from "./appearance.js";
import { DetailsPanel } from "./details.js";
import { MiniDetails, MiniWelcome } from "./mini_screens.js";
import type { ArtboardViewport } from "./shell.js";
import { BrowserFrame, PhoneFrame } from "./stage.js";

/** Selected example screens share responsive previews and the icon inspector. */
export function ExampleWorkspace({
  subject,
  viewport,
  open = false,
  activeTag,
  comparisonEvidence,
  dark = false,
  lightOnly = false,
}: {
  subject: "welcome" | "details";
  viewport: ArtboardViewport;
  open?: boolean;
  activeTag?: string | undefined;
  comparisonEvidence?: ReactNode;
  dark?: boolean;
  lightOnly?: boolean;
}) {
  return (
    <PreviewWorkspace
      viewport={viewport}
      inspector={
        <DetailsPanel
          subject={subject}
          open={open}
          activeTag={activeTag}
          comparisonEvidence={comparisonEvidence}
        />
      }
      render={(previewViewport) => {
        const content =
          subject === "welcome" ? (
            <MiniWelcome compact={previewViewport === "mobile"} />
          ) : (
            <MiniDetails compact={previewViewport === "mobile"} />
          );
        return previewViewport === "mobile" ? (
          <PhoneFrame
            label="Mobile"
            small={viewport === "mobile"}
            dark={dark}
            lightOnly={lightOnly}
          >
            {content}
          </PhoneFrame>
        ) : (
          <BrowserFrame
            address={`example.test/${subject}`}
            label="Desktop"
            dark={dark}
            lightOnly={lightOnly}
          >
            {content}
          </BrowserFrame>
        );
      }}
    />
  );
}

/**
 * The selected screen's workspace on a dual-scheme artboard. Welcome renders in
 * both schemes and follows the catalogue; Details renders in light only, so it
 * keeps its light frames and names that fallback once the catalogue is dark.
 */
export function SchemeWorkspace({
  subject,
  viewport,
  ...rest
}: {
  subject: "welcome" | "details";
  viewport: ArtboardViewport;
  open?: boolean;
  comparisonEvidence?: ReactNode;
}) {
  const dark = useDarkPreview();
  return (
    <ExampleWorkspace
      subject={subject}
      viewport={viewport}
      dark={subject === "welcome" && dark}
      lightOnly={subject === "details" && dark}
      {...rest}
    />
  );
}
