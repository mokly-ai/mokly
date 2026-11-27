import { expect, type Locator } from "@playwright/test";

import { test } from "./browser_test.js";
import { designDocumentFixture } from "./component_design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";

type Viewport = "desktop" | "mobile";

/** A Canvas artboard whose frames draw the shipped highlight mask. */
interface Highlighted {
  route: string;
  /** The artboard draws Highlight components off, so the reader checks it. */
  check: boolean;
  /** The depicted instances, which the view's regions order. */
  instances: string;
  labels: readonly string[];
}

/** Welcome with Highlight components on, and the Toolbar's nested Actions. */
const WELCOME: Highlighted = {
  route: "design/canvas/inspect/frames",
  check: false,
  instances: ".mbk-shot-own-action, .mbk-shot-toolbar",
  labels: ["Action · details", "Toolbar · toolbar"],
};
const TOOLBAR: Highlighted = {
  route: "design/canvas/stage/component-set/toolbar",
  check: true,
  instances: ".mbk-shot-action",
  labels: ["Action · primary", "Action · secondary"],
};

/**
 * Each artboard with whether its frames show the labels: a stage below 60%
 * draws the cutouts without the labels, as Welcome's desktop stage at 42%
 * does. A phone draws the switch only in an open panel sheet: Welcome's
 * phone keeps the highlight on its picked frame, at 72%, and the Toolbar's
 * draws no switch.
 */
const HIGHLIGHTED: Record<
  Viewport,
  readonly (readonly [Highlighted, boolean])[]
> = {
  desktop: [
    [WELCOME, false],
    [TOOLBAR, true],
  ],
  mobile: [[WELCOME, true]],
};

/**
 * Each mask cutout of a frame and each depicted instance, as page boxes. The
 * stage zooms its frames, so a cutout's box maps through its screen matrix,
 * which includes the zoom. Each instance also lists its ancestors' opacity.
 */
function highlightGeometry(frame: Locator, instances: string) {
  return frame.evaluate((node, selector) => {
    const cutouts = [
      ...node.querySelectorAll<SVGGraphicsElement>(".mbk-highlight-cutout"),
    ].map((shape) => {
      const box = shape.getBBox();
      const matrix = shape.getScreenCTM()!;
      const start = new DOMPoint(box.x, box.y).matrixTransform(matrix);
      const end = new DOMPoint(box.x + box.width, box.y + box.height);
      const corner = end.matrixTransform(matrix);
      return [start.x, start.y, corner.x - start.x, corner.y - start.y];
    });
    const elements = [...node.querySelectorAll(selector)];
    return {
      cutouts,
      instances: elements.map((element) => {
        const bounds = element.getBoundingClientRect();
        return [bounds.x, bounds.y, bounds.width, bounds.height];
      }),
      dimmed: elements.flatMap((element) => {
        const opacities: string[] = [];
        for (
          let item: Element | null = element;
          item;
          item = item.parentElement
        )
          opacities.push(getComputedStyle(item).opacity);
        return opacities.filter((opacity) => opacity !== "1");
      }),
    };
  }, instances);
}

/** Run the same assertions against each catalogue delivery. */
export function registerComponentDesignInspection() {
  test.beforeEach(({ allowBrowserError, baseURL }) => {
    documentFavicon(allowBrowserError, baseURL!);
  });
  const { designDocumentUrl } = designDocumentFixture();

  for (const viewport of ["desktop", "mobile"] as const) {
    test.describe(`${viewport} component designs`, () => {
      test.use({
        viewport:
          viewport === "mobile"
            ? { width: 390, height: 844 }
            : { width: 1440, height: 1000 },
      });
      test("mask cutouts match real component bounds without dimming their ancestors", async ({
        page,
      }) => {
        for (const [{ route, check, instances, labels }, shown] of HIGHLIGHTED[
          viewport
        ]) {
          await page.goto(designDocumentUrl(route, viewport));
          if (check)
            await page
              .getByRole("switch", { name: "Highlight components" })
              .check();
          const frames = page.locator(".cv-frame[data-cv-frame]:visible");
          await expect(frames, route).not.toHaveCount(0);
          for (const frame of await frames.all()) {
            // The shipped mask cuts out one box for each region, and the
            // shell labels each region where the zoom shows the labels.
            await expect(
              frame.locator(".mbk-highlight-label:visible"),
              route,
            ).toHaveText(shown ? [...labels] : []);
            const geometry = await highlightGeometry(frame, instances);
            expect(geometry.cutouts, route).toHaveLength(labels.length);
            expect(geometry.instances, route).toHaveLength(labels.length);
            geometry.instances.forEach((bounds, order) =>
              bounds.forEach((value, index) =>
                expect(geometry.cutouts[order]![index], route).toBeCloseTo(
                  value,
                  0,
                ),
              ),
            );
            expect(geometry.dimmed, `${route}: no dimmed ancestor`).toEqual([]);
          }
        }
      });

      // The empty states read the same on a phone, so the desktop alone
      // checks them.
      if (viewport === "desktop")
        test("missing metadata, empty usage, and a removed variant stay distinct", async ({
          page,
        }) => {
          // Profile renders no registered component.
          await page.goto(
            designDocumentUrl("design/canvas/inspect/unchanged", "desktop"),
          );
          const components = page.locator('[data-cv-section="components"]');
          await components.locator(":scope > summary").click();
          await expect(
            components.getByText(
              "No registered components are used in this view.",
              { exact: true },
            ),
          ).toBeVisible();
          // Missing inspection metadata is not an empty view.
          await page.goto(
            designDocumentUrl(
              "design/canvas/components/inspection/unavailable",
              "desktop",
            ),
          );
          await expect(
            components.getByText(
              "Component inspection is unavailable for this view.",
              { exact: true },
            ),
          ).toBeVisible();
          await expect(
            page.getByRole("switch", { name: "Highlight components" }),
          ).toBeDisabled();
          // The example has no component without consumers, so Welcome's Usage
          // shows the explicit empty list.
          await page.goto(
            designDocumentUrl("design/canvas/inspect/sections", "desktop"),
          );
          await expect(
            page
              .locator('[data-cv-section="usage"]')
              .getByText("No recorded consumers.", { exact: true }),
          ).toBeVisible();
          // A removed variant's frames hold the missing current version.
          await page.goto(
            designDocumentUrl("design/canvas/components/removed", "desktop"),
          );
          await expect(
            page
              .locator('.cv-frame[data-cv-frame="compact-light"]')
              .getByText("This variant has been removed.", { exact: true }),
          ).toBeVisible();
        });

      test("a removed consumer opens its previous version behind its Removed badge", async ({
        page,
      }) => {
        await page.goto(
          designDocumentUrl(
            "design/canvas/components/removed/consumer",
            viewport,
          ),
        );
        // Farewell's previous version, where it rendered the Action with
        // Compact's props, behind its Removed status, with no comparison.
        await expect(
          page.locator(".cv-canvas .mbk-entry-status:visible"),
        ).toHaveText("Removed");
        await expect(page.locator(".cv-previous-label:visible")).toHaveText(
          "Showing previous version",
        );
        const frame = page.locator('.cv-frame[data-cv-frame="mobile-light"]');
        await expect(
          frame.getByText("Thanks for looking around", { exact: true }),
        ).toBeVisible();
        await expect(frame.locator(".cv-cx-compact")).toHaveText("Continue");
        // A desktop shows both historical frames, a phone the picked one.
        await expect(
          page.locator('.cv-frame[data-cv-frame="desktop-light"]'),
        ).toBeVisible({ visible: viewport === "desktop" });
        await expect(
          page.getByRole("list", { name: "Comparison mode" }),
        ).toHaveCount(0);
        await expect(page.locator(".mb-pane-missing")).toHaveCount(0);
        await expect(
          page.getByLabel("Appearance", { exact: true }),
        ).toHaveValue("light");
      });
    });
  }

  // A phone draws Usage only in a panel sheet, which the removed variant's
  // artboard shows closed, so the desktop artboard follows the link.
  test.describe("desktop removed consumer", () => {
    test.use({ viewport: { width: 1440, height: 1000 } });
    test("a removed variant's affected list opens its removed consumer's Removed state", async ({
      page,
    }) => {
      await page.goto(
        designDocumentUrl("design/canvas/components/removed", "desktop"),
      );
      const usage = page.locator('[data-cv-section="usage"]');
      await usage.locator(":scope > summary").click();
      await usage
        .locator('[data-usage-section="affected"]')
        .getByRole("link", { name: "Farewell · Removed", exact: true })
        .click();
      await expect(page).toHaveURL(
        designDocumentUrl(
          "design/canvas/components/removed/consumer",
          "desktop",
        ),
      );
      // Inspect stays available on the removed screen: its views are light
      // only, and no current preview exists to highlight. Compact's row
      // returns to the removed variant.
      await expect(
        page
          .getByRole("group", { name: "Frames", exact: true })
          .getByRole("checkbox", { name: /^Dark/u }),
      ).toBeDisabled();
      await expect(
        page.getByRole("switch", { name: "Highlight components" }),
      ).toBeDisabled();
      await expect(
        page.locator(".mbk-nav").getByRole("link", { name: /^Compact/u }),
      ).toHaveAttribute("data-mokly-link", "design/canvas/components/removed");
    });
  });
}
