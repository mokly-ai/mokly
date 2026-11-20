import {
  expectWaitingWithNoAction,
  queuedForReviewer,
  readAsReviewer,
  reviewerProject,
} from "./build-reader";
import { enlargeText, scrollsSideways } from "./build-refusals";
import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import { buildId } from "./viewer/build-fixtures";

/**
 * A phone's reviewer reading a queued build, as
 * `product/viewer/standalone/build/reader/queued` draws it, at 390px, at 320px
 * and at 320px with 200% text.
 */

test("a phone shows a reviewer's queued build with no Cancel", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-mobile-reader");
  const { double, projectId } = scenario;
  double.project = reviewerProject;
  await readAsReviewer(page);
  const id = buildId(460);
  double.builds.set(id, queuedForReviewer(id, projectId));
  for (const { width, enlarged } of [
    { width: 390, enlarged: false },
    { width: 320, enlarged: false },
    { width: 320, enlarged: true },
  ]) {
    const where = width + "px" + (enlarged ? " with 200% text" : "");
    await page.setViewportSize({ width, height: 844 });
    await open(page, scenario.buildAt(id));
    if (enlarged) await enlargeText(page);
    await expectWaitingWithNoAction(page);
    expect(await scrollsSideways(page), where).toBe(false);
  }
  // The compact bar keeps the publication's state.
  await expect(page.locator(".fo-top-state")).toContainText("Publishing now");
  expect(double.cancels).toEqual([]);
});
