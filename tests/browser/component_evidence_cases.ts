import { expect } from "@playwright/test";

import { test as baseTest } from "./browser_test.js";
import { componentDesignFixture } from "./component_design_fixture.js";
import {
  expectReasonSentences,
  type SentenceReason,
} from "./design_reason_sentences.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";

/** Run the same assertions against each catalogue delivery. */
export function registerComponentEvidence(
  test = baseTest,
  mode: "serve" | "static" = "serve",
) {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const { componentDesignUrl } = componentDesignFixture(
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

      test("comparison facts appear only in Details when evidence exists", async ({
        page,
      }) => {
        // Each route's direct reasons; a stylesheet reads only as its files.
        for (const [route, reasons] of [
          ["design/components/pages/comparison", ["material"]],
          ["design/components/pages/stacked/overlay", ["material"]],
          ["design/components/pages/stacked/difference", ["material"]],
          ["design/components/pages/stacked/overlay-tall", ["material"]],
          ["design/components/pages/affected", ["material"]],
          ["design/components/controls/states/comparison", ["material"]],
          ["design/components/states/additions/added", ["added"]],
          ["design/components/states/removed", ["removed"]],
          ["design/components/states/removed-consumer", ["removed"]],
          [
            "design/components/inspection/inspection-direct-change",
            ["inputs", "material"],
          ],
          [
            "design/components/states/shared-impact/style-changed",
            ["implementation"],
          ],
          ["design/components/states/shared-impact/style-outside", []],
          ["design/components/states/shared-impact/affected-screen", []],
          ["design/components/states/shared-impact/shared-impact", []],
        ] as const satisfies readonly (readonly [
          string,
          readonly SentenceReason[],
        ])[]) {
          await page.goto(componentDesignUrl(route, viewport));
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
          await expect(page.locator("[data-workspace-evidence]")).toHaveCount(
            1,
          );
          await expect(
            page.locator("[data-workspace-evidence]"),
          ).not.toContainText("corners and spacing");
          await expectReasonSentences(
            page.locator("[data-workspace-evidence]"),
            reasons,
            `${viewport} ${route}`,
          );
          if (route === "design/components/states/removed-consumer")
            await expect(
              page.getByRole("region", { name: "Details", exact: true }),
            ).toContainText(
              "A former screen that is no longer in the catalogue.",
            );
        }
        for (const route of [
          "design/components/overview",
          "design/components/controls/editing/edited",
          "design/components/states/empty",
        ]) {
          await page.goto(componentDesignUrl(route, viewport));
          await expect(page.locator("[data-workspace-evidence]")).toHaveCount(
            0,
          );
        }
      });

      test("screen comparison names the instance and its before/current props", async ({
        page,
      }) => {
        await page.goto(
          componentDesignUrl(
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

      test("disabled highlighting explains the specific reason", async ({
        page,
      }) => {
        for (const [route, reason] of [
          [
            "design/components/states/empty",
            "No registered components are used in this view.",
          ],
          [
            "design/components/states/unavailable",
            "Component inspection is unavailable for this view.",
          ],
          [
            "design/components/states/removed-consumer",
            "This preview is unavailable.",
          ],
          [
            "design/components/states/shared-impact/affected-screen",
            "A comparison is selected. Highlighting is available in Current.",
          ],
        ]) {
          await page.goto(componentDesignUrl(route!, viewport));
          const toggle = page.getByRole("switch", {
            name: "Highlight components",
          });
          await expect(toggle).toBeDisabled();
          await expect(toggle).toHaveAccessibleDescription(reason!);
          await expect(
            page.locator(".mbk-icon-button:has([data-workspace-highlight])"),
          ).toHaveAttribute("title", reason!);
        }
        await page.goto(
          componentDesignUrl(
            "design/components/inspection/inspection-details",
            viewport,
          ),
        );
        await expect(
          page.getByRole("switch", { name: "Highlight components" }),
        ).toBeEnabled();
      });

      test("highlight chips have clear separation from intact outlines", async ({
        page,
      }) => {
        for (const route of [
          "design/components/inspection/inspection-highlight",
          "design/components/inspection/inspection-nested",
          "design/components/inspection/inspection-consumer",
          "design/components/pages/toolbar",
        ]) {
          await page.goto(componentDesignUrl(route, viewport));
          await page
            .getByRole("switch", { name: "Highlight components" })
            .check();
          // The shipped mask outlines each region, and the region's label
          // stands above its outline at the outline's left edge.
          const preview = page.locator(".ce-preview-view:visible");
          const outlines = preview.locator(".mbk-highlight-outline");
          const labels = preview.locator(".mbk-highlight-label");
          const count = await outlines.count();
          expect(count).toBeGreaterThan(0);
          await expect(labels).toHaveCount(count);
          for (let index = 0; index < count; index++) {
            const { outline, label, radii } = await outlines
              .nth(index)
              .evaluate((rect, order) => {
                const box = rect.getBoundingClientRect();
                const edge = parseFloat(getComputedStyle(rect).strokeWidth) / 2;
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
            expect(outline.y - (label.y + label.height)).toBeGreaterThanOrEqual(
              0,
            );
            expect(label.x).toBeGreaterThanOrEqual(outline.x);
            expect(radii.every((radius) => parseFloat(radius) > 0)).toBe(true);
          }
        }
      });

      test("entry badges distinguish additions, edits, removals, and saved values", async ({
        page,
      }) => {
        for (const [route, status] of [
          ["design/components/pages/affected", "Changed"],
          ["design/components/inspection/inspection-direct-change", "Changed"],
          ["design/components/states/removed", "Removed"],
          ["design/components/states/removed-consumer", "Removed"],
          ["design/components/states/unused", "Unmodified"],
          ["design/components/controls/editing/edited", "Unmodified"],
          ["design/components/states/additions/added", "Added"],
        ]) {
          await page.goto(componentDesignUrl(route!, viewport));
          await expect(
            page.locator(".mbk-screen-head .mbk-entry-status"),
          ).toHaveText(status!);
        }
        const preview = page.locator(".ce-preview-view:visible");
        await expect(
          page.getByRole("group", { name: "Comparison mode" }),
        ).toHaveCount(0);
        await expect(preview.locator(".mb-pane-missing")).toHaveCount(0);
        await expect(preview.locator(".ce-badge")).toHaveText("New");
        await expect(
          page.locator(
            viewport === "desktop"
              ? ".mbk-nav-filter-count"
              : ".ce-change-count",
          ),
        ).toHaveText("1");
        if (viewport === "desktop") {
          await expect(page.locator(".mbk-nav-scroll a")).toContainText([
            "Badge",
            "Default",
          ]);
          await expect(
            page.locator(
              '.mbk-nav-scroll [data-nav-row][data-changed="true"]:not([data-nav-removed]):visible',
            ),
          ).toHaveCount(2);
        }
      });
    });
  }
}
