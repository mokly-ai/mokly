import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import type { ManifestV5 } from "../../packages/viewer/dist/registry/types.js";
import { repositoryRoot } from "../helpers/fixture.js";

const directory = path.join(repositoryRoot, "examples/basic/generated");
const manifest = JSON.parse(
  fs.readFileSync(path.join(directory, "mokly-manifest.json"), "utf8"),
) as ManifestV5;
const changedDesigns = new Set([
  "design-changes-current",
  "design-changes-overlay",
  "design-review-changed",
  "design-review-difference",
  "design-review-dark-scheme",
  "design-review-style-matched",
  "design-review-style-unresolved",
  "design-review-style-unnamed",
  "design-publication-changes",
]);

for (const viewport of ["desktop", "mobile"] as const) {
  test(`${viewport}: every design only offers comparisons with changes and an opaque toolbar`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(
      viewport === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
    );
    for (const entry of manifest.entries) {
      if (entry.kind !== "screen" || !entry.id.startsWith("design-")) continue;
      await page.goto(
        pathToFileURL(path.join(directory, entry.fragments[viewport])).href,
      );
      const componentDesign = entry.route.startsWith("design/components/");
      const changedComponentOrScreen =
        componentDesign &&
        (await page.locator('[data-change-status="changed"]').count()) > 0;
      const removedComponent =
        componentDesign &&
        (await page.locator('[data-change-status="removed"]').count()) > 0 &&
        (await page.locator(".ce-variants").count()) > 0;
      const componentComparison = changedComponentOrScreen || removedComponent;
      const expected = changedDesigns.has(entry.id) || componentComparison;
      const toolbar = page.locator(".mbk-cmp-toolbar");
      await expect(toolbar, entry.id).toHaveCount(expected ? 1 : 0);
      if (!expected) {
        await expect(
          page.locator(".mbk-comparison-stage h3"),
          entry.id,
        ).toHaveCount(0);
      } else {
        await expect(toolbar, entry.id).toHaveCSS(
          "background-color",
          "rgb(255, 255, 255)",
        );
        await expect(toolbar, entry.id).toHaveCSS("display", "flex");
        const bounds = (await toolbar.boundingBox())!;
        for (const control of await toolbar.locator(".mbk-seg").all()) {
          const child = (await control.boundingBox())!;
          expect(child.y, entry.id).toBeGreaterThanOrEqual(bounds.y);
          expect(child.y + child.height, entry.id).toBeLessThanOrEqual(
            bounds.y + bounds.height,
          );
        }
      }
      await page.screenshot({
        path: testInfo.outputPath(`${entry.id}.png`),
        fullPage: true,
      });
    }
  });
}
