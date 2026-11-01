import path from "node:path";

import { expect, type Page, type Locator } from "@playwright/test";

import { paletteColor } from "../helpers/design_palette.js";
import { repositoryRoot } from "../helpers/fixture.js";

export async function openComparisonDesign(
  page: Page,
  route: string,
  viewport: "desktop" | "mobile",
  scheme: "dark" | "light",
  designFileUrl: (file: string) => URL,
): Promise<Locator> {
  await page.setViewportSize(
    viewport === "mobile"
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1000 },
  );
  const file = `${route}/index.${viewport}${scheme === "dark" ? ".dark" : ""}.html`;
  await page.goto(
    designFileUrl(
      path.join(repositoryRoot, "examples/basic/mokly-generated", file),
    ).href,
  );
  const preview = page.locator(
    `.ce-preview-view[data-preview-viewport="${viewport}"]`,
  );
  await expect(preview, file).toHaveCount(1);
  return preview;
}

export async function assertComparisonInk(
  page: Page,
  viewport: "mobile" | "desktop",
  scheme: "light" | "dark",
  designFileUrl: (file: string) => URL,
) {
  const stageInk = await paletteColor(scheme, "--chrome-ink-2");
  for (const route of [
    "design/changes/diff-controls/overlay-long",
    "design/changes/diff-controls/overlay-panel",
    "design/changes/diff-controls/side-by-side-apart",
  ]) {
    const preview = await openComparisonDesign(
      page,
      route,
      viewport,
      scheme,
      designFileUrl,
    );
    const facts = await preview.evaluate((node) => ({
      sections: [...node.querySelectorAll(".mbk-shot-sections h3")].map(
        (heading) => [
          getComputedStyle(heading).color,
          getComputedStyle(heading.closest(".mbk-shot")!).color,
        ],
      ),
      stage: getComputedStyle(node.querySelector(".mbk-diff-view > h3")!).color,
    }));
    expect(facts.sections.length, route).toBeGreaterThan(0);
    for (const [heading, screen] of facts.sections)
      expect(heading, `${route}: the screen's ink`).toBe(screen);
    expect(facts.stage, `${route}: the stage heading`).toBe(stageInk);
  }
}
