import type { Viewport } from "@mokly/mokly";

import { builds } from "../../../fixtures/builds";
import { BuildPage } from "./build-screen";

/**
 * The build running on a newer push of the branch Cal reads, after Cancel
 * was pressed, while its request runs: Cancel reads Cancelling… with the busy
 * spinner and leads nowhere until the request answers, and the card keeps its
 * steps and its output.
 */
export function ViewerBuildCancelBusyScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/cancel-busy"
      build={builds.running}
      busy
    />
  );
}

/**
 * The failed install on the branch Cal reads, after Try again was pressed,
 * while its build request runs: Try again reads Publishing… with the busy
 * spinner and leads nowhere until the request answers, and the card keeps its
 * cause and its output.
 */
export function ViewerBuildTryAgainBusyScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/try-again-busy"
      build={builds.failed}
      busy
    />
  );
}
