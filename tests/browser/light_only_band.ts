/**
 * The note that names a current light-only document's light page under
 * Dark: the reading frame's label, on the canvas and in the compact layout
 * alike. Any host whose shell still offers Dark can check it.
 */

import { expect, type Page } from "@playwright/test";

/**
 * Expect the reading frame's label to name the source file alone under
 * Light, and the fallback after it under Dark, while the frame keeps the
 * light document and nothing else on the stage names the fallback.
 */
export async function expectLightOnlyDocumentLabel(
  page: Page,
  documentPath: string,
  file: string,
): Promise<void> {
  const label = page.locator("[data-mokly-stage] figcaption");
  await expect(label).toHaveText(file);
  await page.locator("[data-mokly-appearance-select]").selectOption("dark");
  await expect(label).toHaveText(`${file} · Light only`);
  await expect(
    page.locator("[data-mokly-stage]").getByText("Light only"),
  ).toHaveCount(1);
  await expect(page.locator("[data-mokly-fragment-frame]")).toHaveAttribute(
    "src",
    new RegExp(`/static/mokly-generated/${documentPath}/index\\.html$`, "u"),
  );
}
