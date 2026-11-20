import type { Viewport } from "@mokly/mokly";

import { builds } from "../../../fixtures/builds";
import { causes } from "../../../fixtures/product-states";

import { BuildPage } from "./build-screen";

/**
 * Alex's pull request, closed after its install failed. Try again was pressed
 * and refused: a closed pull request gets no new build, and a refusal never
 * adds a guide. A pull request from a fork is refused with the same body and
 * its own sentence.
 */
export function ViewerBuildRefusedScreen({ viewport }: { viewport: Viewport }) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/refused"
      build={builds.closed}
      refusal={{ cause: causes.closedPullRequest, retry: false }}
    />
  );
}

/**
 * The build running on a newer push of the branch Cal reads. Cancel was
 * pressed and refused while Mokly was busy. The same request can succeed, so
 * pressing it again can still cancel the build, and the control still reads
 * Cancel, because Try again on a build card requests a new build.
 */
export function ViewerBuildCancelRefusedScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/refused/cancel"
      build={builds.running}
      refusal={{ cause: causes.busy, retry: true }}
    />
  );
}
