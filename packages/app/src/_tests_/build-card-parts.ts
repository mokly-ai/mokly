import type { Page } from "@playwright/test";

import type { BuildScenario } from "./build-scenario";
import { holdRequest } from "./build-state-busy";
import { cardTitle } from "./build-state-parts";
import { expect, open } from "./harness";
import { branchRow, build, buildId, pullRow } from "./viewer/build-fixtures";

/**
 * The parts of the card state lists that `build-states-mobile.spec.ts` walks
 * on a phone to see that no card scrolls sideways: what a state is, the builds
 * the states set, and the ways onto a build card and the publishing card.
 * `build-card-states.ts` lists the build card's states and
 * `build-stage-states.ts` the publishing card's.
 */

/** One state a card draws, reached in the walk's one signed-in project. */
export interface CardState {
  /** The state, as a failure of the walk names it. */
  name: string;
  /**
   * Put the reader on the state and wait until it is drawn. A state that
   * holds a request returns how to let it through once it has been read.
   */
  show: (
    page: Page,
    scenario: BuildScenario,
  ) => Promise<(() => Promise<void>) | void>;
}

/** The builds the states set, one for each. */
export const ids = {
  queued: buildId(40),
  running: buildId(41),
  published: buildId(42),
  failed: buildId(43),
  timedOut: buildId(44),
  superseded: buildId(45),
  cancelled: buildId(46),
  plan: buildId(47),
  lockfile: buildId(48),
  closed: buildId(49),
  fork: buildId(50),
  next: buildId(51),
  reviewer: buildId(52),
};

/** A build that has ended, so it offers no Cancel. */
export const finished = {
  canCancel: false,
  finishedAt: "2026-09-15T16:40:00Z",
};

/** A build whose install exited with an error. */
export const exitFailure = {
  step: "install",
  cause: "exit",
  exitCode: 1,
} as const;

/** Set one build of the double and open its address, until its title shows. */
export async function openBuild(
  page: Page,
  scenario: BuildScenario,
  over: Parameters<typeof build>[0] & { id: string },
  title: string,
): Promise<void> {
  const { double, projectId } = scenario;
  double.builds.set(over.id, build({ projectId, ...over }));
  await open(page, scenario.buildAt(over.id));
  await expect(cardTitle(page, title)).toBeVisible();
}

/** Open the publishing card of the branch or the pull request at `path`. */
export async function openStage(
  page: Page,
  scenario: BuildScenario,
  path: string,
  heading: string,
): Promise<void> {
  scenario.double.branches = [branchRow("topic")];
  scenario.double.pullRequests = [pullRow()];
  await open(page, path);
  await expect(
    page.locator(".fo-stage-card").getByRole("heading", { name: heading }),
  ).toBeVisible();
}

/** The build the next request creates, so a let-through request lands. */
export function queueNext(scenario: BuildScenario): void {
  scenario.double.nextBuild = build({
    id: ids.next,
    projectId: scenario.projectId,
    state: "queued",
    step: null,
    startedAt: null,
  });
}

/**
 * Hold the requests posted to `url`, press the control and wait for its
 * working word. The answer lets the request through and waits for `landed`,
 * what the card shows once the request is answered.
 */
export async function holdPress(
  page: Page,
  url: string,
  control: string,
  working: string,
  landed: () => Promise<void>,
): Promise<() => Promise<void>> {
  const held = await holdRequest(page, url);
  await page.getByTestId(control).click();
  await held.arrived;
  await expect(page.getByTestId(control)).toHaveText(working);
  return async () => {
    held.answer();
    await landed();
    await page.unroute(url);
  };
}
