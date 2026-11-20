import {
  enlargeText,
  publishRefusal,
  refusalLayout,
  scrollsSideways,
} from "./build-refusals";
import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import { branchRow, buildPullRequest, pullRow } from "./viewer/build-fixtures";

/**
 * A phone's refused publish request, as
 * `product/viewer/standalone/publish-refused` and its `pull-request` variant
 * draw it: the refusal, the control, Publish from CI and Details stay inside
 * the card at 390px, at 320px and at 320px with 200% text. Where the row has
 * no room, the guide wraps beneath the control and stays above Details.
 */

/** The widths a refusal is read at, and the one read with 200% text. */
const sizes = [
  { width: 390, enlarged: false },
  { width: 320, enlarged: false },
  { width: 320, enlarged: true },
] as const;

test("a phone keeps a refused publish request, its guide and Details inside the card", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "publish-mobile-refused");
  const { double } = scenario;
  double.branches = [branchRow("topic")];
  double.pullRequests = [pullRow()];
  const state = page.locator(".fo-stage-card .fo-state");
  for (const refused of [
    {
      path: scenario.branchAt("topic"),
      reason: "unavailable" as const,
      sentence: "Mokly is busy. Try again in a moment.",
      // Try again leaves room beside it until the text is enlarged.
      guide: (enlarged: boolean) =>
        enlarged ? "beneath the control" : "beside the control",
    },
    {
      path: scenario.pullAt(buildPullRequest.number),
      reason: "builds-unavailable" as const,
      sentence: "This project publishes from CI.",
      // The control keeps its own longer label, which leaves no room beside
      // it on a phone.
      guide: () => "beneath the control",
    },
  ])
    for (const { width, enlarged } of sizes) {
      const where =
        refused.reason +
        " at " +
        width +
        "px" +
        (enlarged ? " with 200% text" : "");
      await page.setViewportSize({ width, height: 844 });
      double.refuseRequest = { reason: refused.reason };
      await open(page, refused.path);
      await page.getByTestId("stage-publish").click();
      await expect(
        state.locator(".fo-state-action > .fo-write-failure > [role=alert]"),
      ).toHaveText(refused.sentence);
      if (enlarged) await enlargeText(page);
      expect(await scrollsSideways(page), where).toBe(false);
      expect(
        await state.evaluate(refusalLayout, publishRefusal),
        where,
      ).toEqual({
        outside: [],
        inside: ["details", "guide"],
        order: ["refusal above the control", "control above the reference"],
        guide: refused.guide(enlarged),
      });
    }
});
