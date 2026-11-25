import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { designDocumentFixture } from "./component_design_fixture.js";
import { expectReasonSentences } from "./design_reason_sentences.js";
import { documentFavicon } from "./document_error_allowance.js";

type Viewport = "desktop" | "mobile";

/**
 * Artboards whose frames draw highlight chips: the Toolbar's nested Actions
 * once a reader checks Highlight components, and Welcome's phone frame with
 * it on. A phone draws the switch only in an open panel sheet. Welcome's
 * desktop stage stands at 42%, where the frames draw no chips.
 */
const CHIPS: Record<Viewport, readonly (readonly [string, boolean])[]> = {
  desktop: [["design/canvas/stage/component-set/toolbar", true]],
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

/**
 * The paired props of Welcome's own Action in each of its four views, where
 * Welcome changed the label that it supplies: the label before, then now.
 */
const LABEL_PAIRS = Array.from({ length: 4 }, () => [
  /"label": "Continue"/u,
  /"label": "View details"/u,
]).flat();

/** Run the same assertions against each catalogue delivery. */
export function registerComponentEvidence() {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const { designDocumentUrl } = designDocumentFixture();

  for (const viewport of ["desktop", "mobile"] as const) {
    test.describe(`${viewport} comparison evidence`, () => {
      test.use({
        viewport:
          viewport === "desktop"
            ? { width: 1440, height: 1000 }
            : { width: 390, height: 844 },
      });

      // A removed consumer keeps its comparison evidence on its Changes tab,
      // which a phone opens in the panel sheet; the canvas holds none.
      test("a removed consumer's comparison facts appear only in its Changes tab", async ({
        page,
      }) => {
        const route = "design/canvas/components/removed/consumer-changes";
        await page.goto(designDocumentUrl(route, viewport));
        await expect(
          page.locator(".cv-canvas [data-workspace-evidence]"),
        ).toHaveCount(0);
        const panel = page.getByRole("region", { name: "Panel", exact: true });
        await expect(
          panel.getByRole("link", { name: "Changes", exact: true }),
        ).toHaveAttribute("aria-current", "page");
        const evidence = page.locator("[data-workspace-evidence]");
        await expect(evidence).toHaveCount(1);
        await expect(panel.locator(".cv-evidence")).toContainText(
          "Comparison details",
        );
        await expect(evidence).not.toContainText("corners and spacing");
        await expectReasonSentences(
          evidence,
          ["removed"],
          `${viewport} ${route}`,
        );
        // The rail holds the version before alone, and no mode compares.
        await expect(
          panel.getByText(
            "Removed on this branch, so there is no current version to compare.",
            { exact: true },
          ),
        ).toBeVisible();
        await expect(
          page.getByRole("list", { name: "Comparison mode" }),
        ).toHaveCount(0);
        // Inspect, the panel's other tab, opens Farewell's Removed state.
        await panel.getByRole("link", { name: "Inspect", exact: true }).click();
        await expect(page).toHaveURL(
          designDocumentUrl(
            "design/canvas/components/removed/consumer",
            viewport,
          ),
        );
      });

      // Welcome changed the label that it gives its own Action beside the
      // changed Action. The Changes tab, which a phone opens as its sheet,
      // holds the facts; the canvas holds no explanation of its own.
      test("screen comparison names the instance and its before/current props", async ({
        page,
      }) => {
        await page.goto(
          designDocumentUrl(
            "design/canvas/components/affected/direct",
            viewport,
          ),
        );
        await expect(
          page.locator(".cv-canvas [data-workspace-evidence]"),
        ).toHaveCount(0);
        await expect(
          page
            .getByRole("region", { name: "Panel", exact: true })
            .getByRole("link", { name: "Changes", exact: true }),
        ).toHaveAttribute("aria-current", "page");
        const evidence = page.locator(".cv-evidence [data-workspace-evidence]");
        await expect(evidence).toContainText("Action · details");
        // Each view pairs the instance's props before and after the change.
        await expect(evidence.locator("pre")).toHaveText(LABEL_PAIRS);
        await expect(
          evidence.getByText("Changed component: Action", { exact: true }),
        ).toHaveCount(1);
        await expect(
          evidence.getByRole("link", { name: "Action" }),
        ).toHaveAttribute(
          "data-mokly-link",
          "design/canvas/components/compare/current",
        );
        // The compared frames show the same values, and nothing marks the
        // saved change as a temporary edit.
        const own = (side: string) =>
          page.locator(
            `.cv-frame[data-cv-side="${side}"]:visible .mbk-shot-own-action`,
          );
        await expect(own("before")).toHaveText("Continue");
        await expect(own("after")).toHaveText("View details");
        await expect(
          page.locator(".mbk-controls-edited, .mbk-edit-status"),
        ).toHaveCount(0);
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
