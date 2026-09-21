import type { ReactNode } from "react";

import { PreviewWorkspace } from "../components/parts/workspace.js";

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
