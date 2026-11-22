import { expect } from "@playwright/test";

import { test as baseTest } from "./browser_test.js";
import { designDocumentFixture } from "./component_design_fixture.js";
import { expectReasonSentences } from "./design_reason_sentences.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";

type Viewport = "desktop" | "mobile";

/**
 * Artboards whose frames draw highlight chips: Welcome with Highlight
 * components on, and the Toolbar's nested Actions once a reader checks it.
 * A phone draws the switch only in an open panel sheet.
 */
const CHIPS: Record<Viewport, readonly (readonly [string, boolean])[]> = {
  desktop: [
    ["design/canvas/inspect/frames", false],
    ["design/canvas/stage/component-set/toolbar", true],
  ],
  mobile: [["design/canvas/inspect/frames", false]],
};

/** Each entry state's status beside its title, and the entries without one. */
const STATUSES = [
  ["design/canvas/outcomes/added", "Added"],
  ["design/canvas/changes/current", "Changed"],
  ["design/canvas/components/usage", "Changed"],
  ["design/canvas/components/removed", "Removed"],
] as const;
const UNMODIFIED = [
  "design/canvas/inspect/unchanged",
  "design/canvas/props/editing/edited",
] as const;

/** Run the same assertions against each catalogue delivery. */
export function registerComponentEvidence(
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
    test.describe(`${viewport} comparison evidence`, () => {
      test.use({
        viewport:
          viewport === "desktop"
            ? { width: 1440, height: 1000 }
            : { width: 390, height: 844 },
      });

      // No Canvas screen draws a removed screen's previous version until
      // decision 34, so the removed consumer keeps its older subject.
      test("a removed consumer's comparison facts appear only in Details", async ({
        page,
      }) => {
        const route = "design/components/states/removed-consumer";
        await page.goto(designDocumentUrl(route, viewport));
        await expect(
          page.locator(".ce-preview-pane [data-workspace-evidence]"),
        ).toHaveCount(0);
        await expect(page.locator(".ce-change-context")).toHaveCount(0);
        const details = page.getByRole("region", {
          name: "Details",
          exact: true,
        });
        if (!(await details.isVisible()))
          await page
            .getByRole("button", { name: "Details", exact: true })
            .click();
        await expect(details).toContainText("Comparison details");
        await expect(page.locator("[data-workspace-evidence]")).toHaveCount(1);
        await expect(
          page.locator("[data-workspace-evidence]"),
        ).not.toContainText("corners and spacing");
        await expectReasonSentences(
          page.locator("[data-workspace-evidence]"),
          ["removed"],
          `${viewport} ${route}`,
        );
        await expect(details).toContainText(
          "A former screen that is no longer in the catalogue.",
        );
      });

      // No Canvas screen draws a screen's own prop change beside a component
      // change, so the paired props keep their older subject (question Q5).
      test("screen comparison names the instance and its before/current props", async ({
        page,
      }) => {
        await page.goto(
          designDocumentUrl(
            "design/components/inspection/inspection-direct-change",
            viewport,
          ),
        );
        await expect(page.locator(".ce-change-context")).toHaveCount(0);
        await page
          .getByRole("button", { name: "Details", exact: true })
          .click();
        const evidence = page.locator("[data-workspace-evidence]");
        await expect(evidence).toContainText("Action · Footer action");
        // Each view pairs the instance's props before and after the change.
        await expect(evidence.locator("pre")).toContainText([
          "Continue",
          "Get started",
        ]);
        await expect(
          evidence.getByText("Changed component: Action", { exact: true }),
        ).toHaveCount(1);
        await expect(
          evidence.getByRole("link", { name: "Action" }),
        ).toHaveAttribute(
          "data-mokly-link",
          "design/components/pages/affected",
        );
        await page.getByRole("button", { name: "Props", exact: true }).click();
        await expect(page.getByLabel("Supplied props")).toContainText(
          "Get started",
        );
        await expect(page.locator(".ce-prop-change")).toHaveCount(0);
      });

      test("highlight chips have clear separation from intact outlines", async ({
        page,
      }) => {
        for (const [route, check] of CHIPS[viewport]) {
          await page.goto(designDocumentUrl(route, viewport));
          if (check)
            await page
              .getByRole("switch", { name: "Highlight components" })
              .check();
          const frames = page.locator(".cv-frame[data-cv-frame]:visible");
          await expect(frames, route).not.toHaveCount(0);
          for (const frame of await frames.all()) {
            // The shipped mask outlines each region, and the region's label
            // stands above its outline at the outline's left edge.
            const outlines = frame.locator(".mbk-highlight-outline");
            const labels = frame.locator(".mbk-highlight-label");
            await expect(outlines, route).not.toHaveCount(0);
            const count = await outlines.count();
            await expect(labels, route).toHaveCount(count);
            for (let index = 0; index < count; index++) {
              const { outline, label, radii } = await outlines
                .nth(index)
                .evaluate((rect, order) => {
                  const box = rect.getBoundingClientRect();
                  // The stage zooms its frames, and the stroke with them.
                  const scale = (rect as SVGGraphicsElement).getScreenCTM()!.a;
                  const edge =
                    (parseFloat(getComputedStyle(rect).strokeWidth) / 2) *
                    scale;
                  const chip = rect
                    .closest(".ce-highlight-layer")!
                    .querySelectorAll(".mbk-highlight-label")[order]!;
                  const style = getComputedStyle(chip);
                  const bounds = chip.getBoundingClientRect();
                  return {
                    outline: { x: box.x - edge, y: box.y - edge },
                    label: { x: bounds.x, y: bounds.y, height: bounds.height },
                    radii: [
                      style.borderBottomLeftRadius,
                      style.borderBottomRightRadius,
                    ],
                  };
                }, index);
              expect(
                outline.y - (label.y + label.height),
                route,
              ).toBeGreaterThanOrEqual(0);
              expect(label.x, route).toBeGreaterThanOrEqual(outline.x);
              expect(
                radii.every((radius) => parseFloat(radius) > 0),
                route,
              ).toBe(true);
            }
          }
        }
      });

      test("entry badges distinguish additions, edits, removals, and saved values", async ({
        page,
      }) => {
        // The status stands beside the entry's title: in the stage's head on
        // a desktop, and in the entry bar on a phone.
        const status = page.locator(".cv-canvas .mbk-entry-status:visible");
        for (const [route, text] of STATUSES) {
          await page.goto(designDocumentUrl(route, viewport));
          await expect(status, route).toHaveText(text);
        }
        // An unmodified entry and a temporary edit show no status.
        for (const route of UNMODIFIED) {
          await page.goto(designDocumentUrl(route, viewport));
          await expect(page.locator(".cv-root"), route).toHaveCount(1);
          await expect(page.locator(".mbk-entry-status"), route).toHaveCount(0);
        }
      });
    });
  }
}
