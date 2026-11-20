import {
  buildRefusal,
  enlargeText,
  refusalLayout,
  refuseTryAgain,
  scrollsSideways,
} from "./build-refusals";
import { buildScenario } from "./build-scenario";
import { expect, test } from "./harness";
import { buildId } from "./viewer/build-fixtures";

/**
 * A phone's refused Try again, as `product/viewer/standalone/build/refused`
 * draws it: the refusal, the control and Details stay inside the card at
 * 390px and 320px, and with 200% text, for a closed pull request and for a
 * fork's, neither of which offers a guide.
 */

/** The widths a refusal is read at, and the one read with 200% text. */
const sizes = [
  { width: 390, enlarged: false },
  { width: 320, enlarged: false },
  { width: 320, enlarged: true },
] as const;

test("a phone keeps a refused Try again and Details inside the card", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-mobile-refused");
  for (const [index, kind] of (["closed", "fork"] as const).entries())
    for (const { width, enlarged } of sizes) {
      const where =
        kind + " at " + width + "px" + (enlarged ? " with 200% text" : "");
      await page.setViewportSize({ width, height: 844 });
      await refuseTryAgain(page, scenario, buildId(460 + index), kind);
      if (enlarged) await enlargeText(page);
      expect(await scrollsSideways(page), where).toBe(false);
      expect(
        await page.locator(".fo-build").evaluate(refusalLayout, buildRefusal),
        where,
      ).toEqual({
        outside: [],
        inside: ["details"],
        order: ["refusal above the control", "control above the reference"],
        guide: "none",
      });
    }
});
