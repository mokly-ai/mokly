import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import type { ManifestV6 } from "../../packages/viewer/dist/registry/types.js";
import { repositoryRoot } from "../helpers/fixture.js";

const generated = path.join(repositoryRoot, "examples/basic/generated");
const manifest = JSON.parse(
  await fs.readFile(path.join(generated, "mokly-manifest.json"), "utf8"),
) as ManifestV6;
const fileUrl = (route: string) =>
  pathToFileURL(path.join(generated, route)).href;

for (const viewport of ["desktop", "mobile"] as const) {
  test.describe(`${viewport} shared design library`, () => {
    test.use({
      javaScriptEnabled: false,
      viewport:
        viewport === "mobile"
          ? { width: 390, height: 844 }
          : { width: 1440, height: 1000 },
    });

    test("every saved sample loads directly from disk with confined styles and links", async ({
      page,
    }, testInfo) => {
      const failed: string[] = [];
      page.on("requestfailed", (request) => failed.push(request.url()));
      for (const entry of manifest.entries) {
        if (entry.kind !== "component" || !entry.id.startsWith("design-ui-"))
          continue;
        for (const variant of entry.variants) {
          await page.goto(fileUrl(variant.fragments[viewport]));
          await expect(page.locator(".mbk-library-host")).toBeVisible();
          for (const panel of await page
            .locator(".ce-workspace details[open] > .ce-inspector-panel")
            .all()) {
            await expect(panel).toHaveCSS("overflow-y", "auto");
          }
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${entry.id}/${variant.id} fits`,
          ).toBe(true);
          const urls = await page
            .locator("a[href],link[rel=stylesheet]")
            .evaluateAll((nodes) =>
              nodes.map((node) => (node as HTMLAnchorElement).href),
            );
          for (const url of new Set(urls)) {
            expect(url).toMatch(/^file:/);
            await fs.access(new URL(url));
          }
          await page.screenshot({
            path: testInfo.outputPath(`${entry.id}-${variant.id}.png`),
            fullPage: true,
          });
        }
      }
      expect(failed).toEqual([]);
    });

    test("catalogue section headings keep the in-screen typography in isolation", async ({
      page,
    }) => {
      const typography = () =>
        page
          .locator(".mbk-nav-section-head")
          .first()
          .evaluate((node) => {
            const style = getComputedStyle(node);
            return {
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              letterSpacing: style.letterSpacing,
              lineHeight: style.lineHeight,
            };
          });
      await page.goto(
        fileUrl(
          `design/library/chrome/catalogue-navigation.variants/all.${viewport}.html`,
        ),
      );
      const isolated = await typography();
      await page.goto(
        fileUrl(
          viewport === "mobile"
            ? "design/browse/states/navigation.mobile.html"
            : "design/browse/views/details-screen.desktop.html",
        ),
      );
      const inScreen = await typography();
      expect(inScreen).toMatchObject({
        fontSize: "10.5px",
        fontWeight: "700",
      });
      expect(isolated).toEqual(inScreen);
    });

    test("the top-bar logo keeps the in-screen colors in isolation", async ({
      page,
    }) => {
      const logo = () =>
        page.locator(".mbk-brand").evaluate((brand) => {
          const color = (selector: string) => {
            const node = brand.querySelector(selector);
            return node && getComputedStyle(node).color;
          };
          return {
            brand: getComputedStyle(brand).color,
            mark: color(".mbk-mark"),
            rules: getComputedStyle(brand.querySelector(".mbk-mark-rules")!)
              .stroke,
            name: color(".mbk-name"),
          };
        });
      await page.goto(
        fileUrl(
          `design/library/chrome/top-bar.variants/default.${viewport}.html`,
        ),
      );
      const isolated = await logo();
      await page.goto(fileUrl(`design/browse/views/home.${viewport}.html`));
      const inScreen = await logo();
      expect(inScreen).toEqual({
        brand: "rgb(26, 29, 28)",
        mark: "rgb(47, 89, 69)",
        rules: "rgb(255, 255, 255)",
        name: viewport === "desktop" ? "rgb(26, 29, 28)" : null,
      });
      expect(isolated).toEqual(inScreen);
    });

    test("the last flow step has no trailing connector after registered boundaries", async ({
      page,
    }) => {
      await page.goto(fileUrl(`design/browse/views/use-case.${viewport}.html`));
      const steps = page.locator(".flow-step");
      await expect(steps).toHaveCount(2);
      expect(
        await steps
          .first()
          .evaluate((node) => getComputedStyle(node, "::before").display),
      ).not.toBe("none");
      expect(
        await steps
          .last()
          .evaluate((node) => getComputedStyle(node, "::before").display),
      ).toBe("none");
    });

    test("standalone inline components retain their intrinsic width", async ({
      page,
    }) => {
      for (const [slug, selector] of [
        ["tag-chip", ".mbk-chip"],
        ["change-status", ".ce-change-status"],
      ]) {
        const entry = manifest.entries.find(
          (entry) => entry.id === `design-ui-${slug}`,
        );
        if (entry?.kind !== "component") throw new Error(`Missing ${slug}`);
        await page.goto(fileUrl(entry.variants[0]!.fragments[viewport]));
        expect(
          (await page.locator(selector!).boundingBox())!.width,
        ).toBeLessThan(150);
      }
    });

    test("the icon footer sample keeps its open content visible", async ({
      page,
    }) => {
      const entry = manifest.entries.find(
        (entry) => entry.id === "design-ui-inspector",
      );
      if (entry?.kind !== "component") throw new Error("Missing footer panel");
      await page.goto(
        fileUrl(
          entry.variants.find((variant) => variant.id === "details")!.fragments[
            viewport
          ],
        ),
      );
      await expect(
        page.getByText(
          "A shared action with an optional destination and hint.",
        ),
      ).toBeInViewport();
    });
  });
}

test("mobile comparison samples fit with wider fallback fonts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "chrome/screen-header.variants/changed",
    "controls/comparison-toolbar.variants/side-by-side",
  ]) {
    await page.goto(fileUrl(`design/library/${route}.mobile.html`));
    await page.addStyleTag({
      content: ":root { --sans: Verdana, sans-serif; }",
    });
    const toolbar = page.getByRole("group", { name: "Comparison mode" });
    await expect(toolbar.getByRole("button")).toHaveCount(4);
    const bounds = await toolbar.boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  }
});

test("mobile footer component owns its full-width sheet surface", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const entry = manifest.entries.find(
    (candidate) => candidate.id === "design-ui-inspector",
  );
  if (entry?.kind !== "component") throw new Error("Missing footer panel");
  await page.goto(
    fileUrl(
      entry.variants.find((variant) => variant.id === "details")!.fragments
        .mobile,
    ),
  );
  const workspace = page.locator(".ce-workspace");
  const dock = page.locator(".ce-inspector-dock");
  const inspector = page.locator(".ce-inspector");
  const [workspaceBounds, dockBounds] = await Promise.all([
    workspace.boundingBox(),
    dock.boundingBox(),
  ]);
  expect(workspaceBounds).not.toBeNull();
  expect(dockBounds).not.toBeNull();
  expect(dockBounds!.x).toBeCloseTo(workspaceBounds!.x, 0);
  expect(dockBounds!.width).toBeCloseTo(workspaceBounds!.width, 0);
  await expect(dock).toHaveCSS("border-top-width", "0px");
  await expect(dock).toHaveCSS("border-top-left-radius", "0px");
  await expect(dock).toHaveCSS("box-shadow", "none");
  await expect(inspector).toHaveCSS("border-top-width", "1px");
  await expect(inspector).toHaveCSS("border-top-left-radius", "20px");
  await expect(inspector).not.toHaveCSS("box-shadow", "none");
});
