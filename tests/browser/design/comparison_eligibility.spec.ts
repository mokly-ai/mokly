import fs from "node:fs";
import path from "node:path";

import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { parse, type DefaultTreeAdapterMap } from "parse5";

import { viewRoute } from "../../../packages/viewer/dist/data.js";
import type {
  ManifestScreen,
  ManifestV8,
} from "../../../packages/viewer/dist/registry/types.js";
import { paletteColor } from "../../helpers/design_palette.js";
import { repositoryRoot } from "../../helpers/fixture.js";

import { designArtboardUrl } from "./artboards.js";

const directory = path.join(repositoryRoot, "examples/basic/generated");
const manifest = JSON.parse(
  fs.readFileSync(path.join(directory, "mokly-manifest.json"), "utf8"),
) as ManifestV8;

function hasComparisonBand(node: DefaultTreeAdapterMap["node"]): boolean {
  if (
    "tagName" in node &&
    node.attrs.some(
      (attribute) =>
        attribute.name === "class" &&
        attribute.value.split(/\s+/u).includes("mbk-cmp-toolbar"),
    )
  )
    return true;
  return "childNodes" in node && node.childNodes.some(hasComparisonBand);
}
async function assertFragmentEligibility(
  page: Page,
  testInfo: TestInfo,
  entry: ManifestScreen,
  viewport: "mobile" | "desktop",
  appearance: "light" | "dark",
  fragment: string,
): Promise<void> {
  await page.goto(designArtboardUrl(entry.path, viewport, appearance));
  const toolbar = page.locator(".mbk-cmp-toolbar");
  if (await toolbar.count()) {
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
    await page.screenshot({
      path: testInfo.outputPath(`${entry.path}.${appearance}.png`),
      fullPage: true,
    });
  }
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
    let measured = 0;
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
        const html = fs.readFileSync(path.join(directory, fragment), "utf8");
        if (!hasComparisonBand(parse(html))) continue;
        measured += 1;
        await assertFragmentEligibility(
          page,
          testInfo,
          entry,
          viewport,
          appearance,
          fragment,
        );
      }
    }
    expect(
      measured,
      "comparison styles have real artboards to measure",
    ).toBeGreaterThan(0);
  });
}
