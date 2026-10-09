import type { ReactNode } from "react";

import { CompareGrid, Pane } from "./compare.js";
import { ComparePage, FramedShot } from "./compare_page.js";
import type { DesignDestination } from "./destinations.js";
import { MiniWelcome } from "./mini_screens.js";
import { StyleReviewNav } from "./review.js";
import type { ArtboardViewport } from "./shell.js";

/**
 * A Welcome that a stylesheet edit keeps in Changes, opened in its loaded
 * side-by-side comparison, with the stylesheet evidence in Details.
 */
export function StyleComparison({
  design,
  evidence,
  viewport,
}: {
  design: DesignDestination;
  evidence: ReactNode;
  viewport: ArtboardViewport;
}) {
  return (
    <ComparePage
      design={design}
      evidence={evidence}
      path="example/screens/welcome"
      nav={<StyleReviewNav welcome={design} />}
      state="styles-changed"
      subject="welcome"
      title="Welcome"
      viewport={viewport}
      render={(previewViewport) => (
        <CompareGrid>
          <Pane label="Before" side="before">
            <FramedShot
              address="example.test/welcome"
              viewport={previewViewport}
            >
              <MiniWelcome compact={previewViewport === "mobile"} inert />
            </FramedShot>
          </Pane>
          <Pane label="Current" side="after">
            <FramedShot
              address="example.test/welcome"
              viewport={previewViewport}
            >
              <MiniWelcome
                compact={previewViewport === "mobile"}
                inert
                restyled
              />
            </FramedShot>
          </Pane>
        </CompareGrid>
      )}
    />
  );
}
