import { expect } from "@playwright/test";

import { test as baseTest } from "./browser_test.js";
import { designDocumentFixture } from "./component_design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";

/** The Action's variant set in each compare mode that stacks its versions. */
const STACKED = [
  "design/canvas/components/compare",
  "design/canvas/components/compare/difference",
] as const;

/** Run the same assertions against each catalogue delivery. */
export function registerDesignComponentStacks(
  test = baseTest,
  mode: "serve" | "static" = "serve",
) {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const { designDocumentUrl } = designDocumentFixture(
    test,
    mode === "static" ? copiedDesignFileUrl : undefined,
  );

  for (const viewport of ["desktop", "mobile"] as const) {
    test(`${viewport}: Action's versions sit at one position in the frame`, async ({
      page,
    }) => {
      await page.setViewportSize(
        viewport === "mobile"
          ? { width: 390, height: 844 }
          : { width: 1440, height: 1000 },
      );
      for (const route of STACKED) {
        await page.goto(designDocumentUrl(route, viewport));
        const frames = page.locator(".cv-frame[data-cv-frame]:visible");
        await expect(frames, route).not.toHaveCount(0);
        for (const frame of await frames.all()) {
          const facts = await frame.evaluate((node) => {
            const scroller = node.querySelector(".mb-viewport")!;
            const bounds = scroller.getBoundingClientRect();
            // The stage zooms the frame: measure in the frame's own pixels.
            const scale = bounds.width / scroller.clientWidth;
            // Each version's document draws its Action from the top left, as
            // the shell's documents do, so the two corners coincide.
            const corner = (side: string) => {
              const rect = scroller
                .querySelector(`.mb-pane--${side} .mbk-shot-action`)!
                .getBoundingClientRect();
              return [
                (rect.left - bounds.left) / scale,
                (rect.top - bounds.top) / scale,
              ];
            };
            return {
              after: corner("after"),
              before: corner("before"),
              frame: node.getAttribute("data-cv-frame"),
            };
          });
          const where = `${route} ${facts.frame}`;
          facts.after.forEach((value, index) =>
            expect(Math.abs(value - facts.before[index]!), where).toBeLessThan(
              0.5,
            ),
          );
          for (const offset of facts.before)
            expect(
              offset,
              `${where}: 24px from the frame's top left, as the shell's documents draw it`,
            ).toBeCloseTo(24, 0);
        }
      }
    });
  }
}
