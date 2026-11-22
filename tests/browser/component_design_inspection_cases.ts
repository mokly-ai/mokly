import { expect, type Locator } from "@playwright/test";

import { test as baseTest } from "./browser_test.js";
import { designDocumentFixture } from "./component_design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";

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
 * A phone draws the switch only in an open panel sheet: Welcome's phone keeps
 * the highlight on its picked frame, and the Toolbar's draws no switch.
 */
const HIGHLIGHTED: Record<Viewport, readonly Highlighted[]> = {
  desktop: [WELCOME, TOOLBAR],
  mobile: [WELCOME],
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
export function registerComponentDesignInspection(
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
        for (const { route, check, instances, labels } of HIGHLIGHTED[
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
            // shell labels each region.
            await expect(
              frame.locator(".mbk-highlight-label:visible"),
              route,
            ).toHaveText([...labels]);
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

      test("missing metadata, empty usage, and a removed variant stay distinct", async ({
        page,
      }) => {
        // Profile renders no registered component.
        await page.goto(
          designDocumentUrl("design/canvas/inspect/unchanged", viewport),
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
            viewport,
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
          designDocumentUrl("design/canvas/inspect/sections", viewport),
        );
        await expect(
          page
            .locator('[data-cv-section="usage"]')
            .getByText("No recorded consumers.", { exact: true }),
        ).toBeVisible();
        // A removed variant's frames hold the missing current version.
        await page.goto(
          designDocumentUrl("design/canvas/components/removed", viewport),
        );
        await expect(
          page
            .locator('.cv-frame[data-cv-frame="compact-light"]')
            .getByText("This variant has been removed.", { exact: true }),
        ).toBeVisible();
      });

      // No Canvas screen draws a removed screen's previous version until
      // decision 34, so the removed consumer keeps its older subjects.
      test("a removed consumer opens its previous version behind its Removed badge", async ({
        page,
      }) => {
        await page.goto(
          designDocumentUrl("design/components/states/removed", viewport),
        );
        await expect(
          page
            .locator(".ce-preview-view:visible")
            .getByText("This variant has been removed.", { exact: true }),
        ).toBeVisible();
        await page
          .locator('[data-usage-section="affected"]')
          .getByRole("link", { name: "Farewell" })
          .click();
        await expect(page).toHaveURL(
          designDocumentUrl(
            "design/components/states/removed-consumer",
            viewport,
          ),
        );
        await expect(page.locator(".mbk-previous")).toHaveText(
          "Showing previous version",
        );
        await expect(
          page
            .locator(".ce-preview-view:visible")
            .getByText("Come back whenever you are ready.", { exact: true }),
        ).toBeVisible();
        await expect(
          page.locator(".ce-preview-view:visible .ce-action--before"),
        ).toBeVisible();
        await expect(page.locator(".ce-preview-set")).toHaveAttribute(
          "data-viewport",
          viewport,
        );
        await expect(
          page.locator(
            viewport === "desktop"
              ? ".ce-preview-view:visible .browser-frame"
              : ".ce-preview-view:visible .phone-frame",
          ),
        ).toBeVisible();
        await expect(
          page.getByRole("group", { name: "Comparison mode" }),
        ).toHaveCount(0);
        await expect(page.locator(".mb-pane-missing")).toHaveCount(0);
        await expect(
          page.getByRole("switch", { name: "Dark mode" }),
        ).toHaveCount(0);
        await expect(
          page.getByLabel("Appearance", { exact: true }),
        ).toHaveValue("light");
        await expect(
          page.getByRole("switch", { name: "Highlight components" }),
        ).toBeDisabled();
        await expect(
          page
            .locator(
              viewport === "desktop" ? ".mbk-nav" : ".ce-mobile-location",
            )
            .getByRole("link", {
              name: viewport === "desktop" ? "Action" : /Changes/,
            }),
        ).toHaveAttribute(
          "data-mokly-link",
          "design/components/states/removed",
        );
        await expect(
          page.getByRole("button", { name: "Details", exact: true }),
        ).toBeVisible();
      });
    });
  }
}
