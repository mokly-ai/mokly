import type { Viewport } from "@mokly/mokly";

import { sample } from "../../../fixtures/product";
import { publication } from "../../../fixtures/publications";
import { Action, StateMessage } from "../page-parts";

import { readyDetail } from "./pill";
import { ViewerScreen } from "./screen";
import { BranchSlot } from "./slots";
import { StageCard } from "./stage-card";

/**
 * The pinned viewer's version error, drawn as mockup-only evidence: its one
 * headline for every host, and the diagnostic its index reader reports for a
 * catalogue index of the release before, which the host keeps in Details.
 */
const versionFailure = {
  message: "This catalogue needs a compatible viewer",
  details:
    "Unsupported Mokly catalogue version 8; this viewer supports version 9.",
} as const;

/** A failed viewer source keeps the cloud chrome and one recovery action. */
export function ViewerVersionScreen({ viewport }: { viewport: Viewport }) {
  return (
    <ViewerScreen
      id="product/viewer/standalone/version"
      state="default"
      viewport={viewport}
      heading={sample.project + " · " + publication.branch}
      publication={
        <BranchSlot
          viewport={viewport}
          name={publication.branch}
          meta={{
            state: "ready",
            detail: readyDetail(publication.published),
            sha: publication.sha,
          }}
        />
      }
    >
      <StageCard>
        <StateMessage
          title={versionFailure.message}
          error
          details={versionFailure.details}
          action={
            <Action
              instance="version-reload"
              label="Reload"
              tone="primary"
              size="md"
              icon="retry"
            />
          }
        />
      </StageCard>
    </ViewerScreen>
  );
}
