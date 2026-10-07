import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { viewRoute } from "../../packages/viewer/dist/data.js";
import type {
  ManifestScreen,
  ManifestV9,
} from "../../packages/viewer/dist/registry/types.js";
import { paletteColor } from "../helpers/design_palette.js";
import { repositoryRoot } from "../helpers/fixture.js";

const directory = path.join(repositoryRoot, "examples/basic/mokly-generated");
const manifest = JSON.parse(
  fs.readFileSync(path.join(directory, "mokly-manifest.json"), "utf8"),
) as ManifestV9;
const changedDesigns = new Set([
  "design/browse/variants/variant-changes",
  "design/browse/index-entries/member-changes",
  "design/changes/diff-controls/current",
  "design/changes/outcomes/moved",
  "design/changes/diff-controls/overlay",
  "design/changes/diff-controls/overlay-long",
  "design/changes/diff-controls/overlay-panel",
  "design/changes/diff-controls/side-by-side-apart",
  "design/changes/outcomes/changed",
  "design/changes/outcomes/difference",
  "design/changes/impact/styles/matched",
  "design/changes/impact/styles/unresolved",
  "design/changes/impact/styles/unnamed",
  "design/browse/publication/changes",
  "design/browse/appearance/workspaces/side-by-side",
  "design/browse/appearance/workspaces/difference",
]);

async function assertFragmentEligibility(
  page: Page,
  testInfo: TestInfo,
  entry: ManifestScreen,
  appearance: "light" | "dark",
  fragment: string,
): Promise<void> {
  await page.goto(pathToFileURL(path.join(directory, fragment)).href);
  const componentDesign = entry.path.startsWith("design/components/");
  const changedComponentOrScreen =
    componentDesign &&
    (await page.locator('[data-change-status="changed"]').count()) > 0;
  const removedComponent =
    componentDesign &&
    (await page.locator('[data-change-status="removed"]').count()) > 0 &&
    (await page.locator(".ce-variants").count()) > 0;
  const expected =
    changedDesigns.has(entry.path) ||
    changedComponentOrScreen ||
    removedComponent;
  const toolbar = page.locator(".mbk-cmp-toolbar");
  await expect(toolbar, fragment).toHaveCount(expected ? 1 : 0);
  if (!expected) {
    await expect(
      page.locator(".mbk-comparison-stage h3"),
      fragment,
    ).toHaveCount(0);
  } else {
    await expect(toolbar, fragment).toHaveCSS(
      "background-color",
      await paletteColor(appearance, "--chrome-surface"),
    );
    await expect(toolbar, fragment).toHaveCSS("display", "flex");
    const bounds = await toolbar.boundingBox();
    expect(bounds, fragment).not.toBeNull();
    for (const control of await toolbar.locator(".mbk-seg").all()) {
      const child = await control.boundingBox();
      expect(child, fragment).not.toBeNull();
      expect(child!.y, fragment).toBeGreaterThanOrEqual(bounds!.y);
      expect(child!.y + child!.height, fragment).toBeLessThanOrEqual(
        bounds!.y + bounds!.height,
      );
    }
  }
  await page.screenshot({
    path: testInfo.outputPath(`${entry.path}.${appearance}.png`),
    fullPage: true,
  });
}

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
      if (entry.kind !== "screen" || !entry.path.startsWith("design/"))
        continue;
      for (const [appearance, fragment] of [
        ["light", viewRoute(entry.path, viewport, "light")],
        [
          "dark",
          entry.colorSchemes.includes("dark")
            ? viewRoute(entry.path, viewport, "dark")
            : undefined,
        ],
      ] as const) {
        if (!fragment) continue;
        await assertFragmentEligibility(
          page,
          testInfo,
          entry,
          appearance,
          fragment,
        );
      }
    }
  });
}
