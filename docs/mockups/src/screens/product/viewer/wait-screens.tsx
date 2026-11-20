import type { Viewport } from "@mokly/mokly";

import { workspace } from "../../../fixtures/product";
import { publication } from "../../../fixtures/publications";

import { ViewerScreen } from "./screen";
import { SlotPlaceholder } from "./slots";
import { StageWait } from "./stage-card";
import { StandalonePage } from "./standalone-page";

/**
 * The viewer's waits that are situations of their own, beside the loading
 * state of each entry: the route's project read, the read of a publication's
 * address, the workspace read that decides the Team card, and a publication
 * that CI still uploads. Each stage holds the stage's waiting card, titled
 * with its read where no heading names it.
 */

/**
 * The viewer's address while the route reads its project. The package appears
 * only once a publication is ready, so the cloud frame is what the reader sees
 * first: the bar's controls in their waiting forms over the stage's waiting
 * card. The heading names the read for screen readers, so the card's title is
 * a bar. The package's own controls are not drawn, because the cloud draws
 * only its slots.
 */
export function ViewerProjectLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <ViewerScreen
      id="product/viewer/standalone"
      state="loading"
      screen="product/viewer/standalone/project-loading"
      viewport={viewport}
      publication={<SlotPlaceholder viewport={viewport} />}
      waiting="Opening your project"
    />
  );
}

/**
 * A publication's address while its publication is read, as every alias
 * opens it once it resolves. The address names a publication and no
 * reference, so the reference trigger waits as its placeholder in its own
 * frame beside the state's Loading, and the heading names the project alone.
 * The project is known, so the rest of the bar is the loaded bar, and the
 * stage's waiting card names the read.
 */
export function ViewerPublicationLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <StandalonePage
      viewport={viewport}
      state="loading"
      screen="product/viewer/standalone/publication-loading"
      unnamed
    />
  );
}

/**
 * A branch with nothing published in a private project on the free plan,
 * while the workspace read decides whether the reader can open Billing. The
 * project trigger names the workspace by its address until that read answers,
 * and the stage's waiting card names the read.
 */
export function ViewerPlanLoadingScreen({ viewport }: { viewport: Viewport }) {
  return (
    <StandalonePage
      viewport={viewport}
      state="empty"
      screen="product/viewer/standalone/plan-loading"
      workspace={workspace.slug}
      stage={<StageWait label="Checking publishing access" />}
    />
  );
}

/**
 * The address names a publication that CI still uploads. The chrome says that
 * it is publishing, with its commit, and the stage's waiting card names the
 * wait until the catalogue is ready.
 */
export function ViewerUploadingScreen({ viewport }: { viewport: Viewport }) {
  return (
    <StandalonePage
      viewport={viewport}
      state="loading"
      screen="product/viewer/standalone/uploading"
      publicationMeta={{
        state: "publishing",
        detail: "Publishing now",
        sha: publication.sha,
      }}
      stage={<StageWait label="Publishing this branch" />}
    />
  );
}
