/**
 * Build cards whose body depends on who reads them: a reader the project does
 * not let request or cancel builds, and the plan refusal for everyone who is
 * not an owner, before and after the workspace read decides which they are.
 */

import type { Viewport } from "@mokly/mokly";

import { builds } from "../../../fixtures/builds";
import { members } from "../../../fixtures/product";

import { namedReader } from "./account-trigger";
import type { BuildReader } from "./build-card";
import { BuildPage } from "./build-screen";

/**
 * Sam, a reviewer, who reads builds but may neither request nor cancel them,
 * and is not an owner.
 */
const reviewer: BuildReader = {
  canRequestBuilds: false,
  canCancel: false,
  role: "not-owner",
};

/**
 * The failed install on the branch Cal reads, read by Sam, a reviewer, who
 * cannot request builds: the cause's sentence stays, and the card offers no
 * action.
 */
export function ViewerBuildReaderScreen({ viewport }: { viewport: Viewport }) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/reader"
      build={builds.failed}
      reader={reviewer}
      account={namedReader(members[2])}
    />
  );
}

/**
 * The build the plan refused, read by Alex, an administrator who is not an
 * owner: the line says who can upgrade, and the card offers no action.
 */
export function ViewerBuildReaderPlanScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/reader/plan"
      build={builds.plan}
      reader={{ canRequestBuilds: true, canCancel: true, role: "not-owner" }}
      account={namedReader(members[1])}
    />
  );
}

/**
 * The same refusal while the workspace read decides whether the reader
 * can open Billing: the title alone, with no line and no action.
 */
export function ViewerBuildReaderPlanLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/reader/plan-loading"
      build={builds.plan}
      reader={{ canRequestBuilds: true, canCancel: true, role: "pending" }}
    />
  );
}

/**
 * The build requested on Alex's branch, waiting for a worker, read by Sam,
 * who cannot cancel builds: the card says it waits to start and offers no
 * action.
 */
export function ViewerBuildReaderQueuedScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/reader/queued"
      build={builds.queued}
      reader={reviewer}
      account={namedReader(members[2])}
    />
  );
}

/**
 * The build running on a newer push of the branch Cal reads, read by Sam,
 * who cannot cancel builds: its steps and its live output, with no line and
 * no action.
 */
export function ViewerBuildReaderRunningScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/reader/running"
      build={builds.running}
      reader={reviewer}
      account={namedReader(members[2])}
    />
  );
}
