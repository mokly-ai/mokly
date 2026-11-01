import type { ReactNode } from "react";

import { PreviewWorkspace } from "../../../components/parts/workspace.js";
import { DetailsPanel, type CardEvidence } from "../../../parts/details.js";
import { MiniProfile, MiniSecurity } from "../../../parts/mini_account.js";
import { ViewSwitch, type ArtboardViewport } from "../../../parts/shell.js";
import { BrowserFrame, PhoneFrame } from "../../../parts/stage.js";

type ProfileSubject = "profile" | "profileSecurity";

/**
 * The selected Profile or Security screen in both previews, Details closed. A
 * changed screen's Details add its comparison details.
 */
export function ProfileWorkspace({
  comparisonEvidence,
  header,
  subject,
  viewport,
}: {
  comparisonEvidence?: CardEvidence | undefined;
  /** The screen header with the view controls. */
  header: ReactNode;
  subject: ProfileSubject;
  viewport: ArtboardViewport;
}) {
  return (
    <PreviewWorkspace
      header={header}
      // Profile and Security render no registered component, so the shell
      // disables Highlight components with its empty reason.
      view={{ highlight: "empty" }}
      viewport={viewport}
      inspector={
        <DetailsPanel
          comparisonEvidence={comparisonEvidence}
          subject={subject}
        />
      }
      render={(previewViewport) => {
        const compact = previewViewport === "mobile";
        const content =
          subject === "profile" ? (
            <MiniProfile compact={compact} />
          ) : (
            <MiniSecurity compact={compact} />
          );
        return previewViewport === "mobile" ? (
          <PhoneFrame small={viewport === "mobile"}>{content}</PhoneFrame>
        ) : (
          <BrowserFrame
            address={
              subject === "profile"
                ? "example.test/account/profile"
                : "example.test/account/profile/security"
            }
          >
            {content}
          </BrowserFrame>
        );
      }}
    />
  );
}

/** The view controls of a Profile or Security header. */
export function viewSwitch(viewport: ArtboardViewport) {
  return <ViewSwitch active={viewport === "mobile" ? "mobile" : "both"} />;
}
