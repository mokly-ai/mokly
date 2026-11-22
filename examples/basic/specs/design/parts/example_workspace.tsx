import type { ReactNode } from "react";

import { PreviewWorkspace } from "../components/parts/workspace.js";

import { DetailsPanel } from "./details.js";
import { MiniDetails, MiniWelcome } from "./mini_screens.js";
import { miniView } from "./mini_views.js";
import type { ArtboardViewport } from "./shell.js";
import { BrowserFrame, PhoneFrame } from "./stage.js";

/**
 * Selected example screens share responsive previews and the icon inspector.
 * The depicted view's record follows the depicted form of the screen, so the
 * header's Highlight components switch draws its preview's regions.
 */
export function ExampleWorkspace({
  header,
  subject,
  viewport,
  open = false,
  activeTag,
  changedViews,
  dark = false,
  empty = false,
  error = false,
  lightOnly = false,
}: {
  /** The screen header with the view controls. */
  header: ReactNode;
  subject: "welcome" | "details";
  viewport: ArtboardViewport;
  open?: boolean;
  activeTag?: string | undefined;
  changedViews?: ReactNode;
  dark?: boolean;
  /** Depict Welcome before anything has been entered. */
  empty?: boolean;
  /** Depict Welcome after a save did not complete. */
  error?: boolean;
  lightOnly?: boolean;
}) {
  return (
    <PreviewWorkspace
      header={header}
      view={miniView(
        subject === "details"
          ? "details"
          : empty
            ? "welcome-empty"
            : error
              ? "welcome-error"
              : "welcome",
      )}
      viewport={viewport}
      inspector={
        <DetailsPanel
          subject={subject}
          open={open}
          activeTag={activeTag}
          changedViews={changedViews}
        />
      }
      render={(previewViewport) => {
        const content =
          subject === "welcome" ? (
            <MiniWelcome
              compact={previewViewport === "mobile"}
              empty={empty}
              error={error}
            />
          ) : (
            <MiniDetails compact={previewViewport === "mobile"} />
          );
        return previewViewport === "mobile" ? (
          <PhoneFrame
            small={viewport === "mobile"}
            dark={dark}
            lightOnly={lightOnly}
          >
            {content}
          </PhoneFrame>
        ) : (
          <BrowserFrame
            address={`example.test/${subject}`}
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
