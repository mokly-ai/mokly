/**
 * The note that names a current light-only document's light page under
 * Dark: the reading frame's label on the canvas, and in the narrow layout the
 * quiet band above the document pane, as
 * `design/browse/appearance/states/light-only-current` depicts. Any host
 * whose shell still offers Dark can check it.
 */

import { expect, type Page } from "@playwright/test";

/**
 * On the canvas, expect the reading frame's label to name the source file
 * alone under Light, and the fallback after it under Dark, while the frame
 * keeps the light document and no band shows.
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
  await expect(page.locator(".mbk-scheme-fallback")).toHaveCount(0);
  await expect(page.locator("[data-mokly-fragment-frame]")).toHaveAttribute(
    "src",
    new RegExp(`/static/mokly-generated/${documentPath}/index\\.html$`, "u"),
  );
}

/**
 * In the narrow layout, expect no band under Light, then choose Dark and
 * expect one band above the document pane, with the approved border, colour,
 * size, weight, and padding.
 */
export async function expectLightOnlyDocumentBand(
  page: Page,
  documentPath: string,
  width: number,
): Promise<void> {
  const band = page.locator(".mbk-previous.mbk-scheme-fallback");
  await expect(band).toHaveCount(1);
  await expect(band).toBeHidden();
  await page.locator("[data-mokly-appearance-select]").selectOption("dark");
  await expect(band).toBeVisible();
  await expect(band).toHaveText("Light only");
  expect(
    await band.evaluate((element) => {
      const style = getComputedStyle(element);
      const note = element.querySelector(".mbk-frame-scheme-note");
      const muted = document.createElement("span");
      muted.style.color = "var(--chrome-muted)";
      element.append(muted);
      const expectedColor = getComputedStyle(muted).color;
      muted.remove();
      return {
        borderBottom: `${style.borderBottomWidth} ${style.borderBottomStyle}`,
        color: style.color === expectedColor,
        fontSize: style.fontSize,
        noteDisplay: note ? getComputedStyle(note).display : null,
        noteWeight: note ? getComputedStyle(note).fontWeight : null,
        padding: style.padding,
      };
    }),
  ).toEqual({
    borderBottom: "1px solid",
    color: true,
    fontSize: "11.5px",
    noteDisplay: "inline",
    noteWeight: "500",
    padding: width > 760 ? "8px 24px" : "8px 16px",
  });
  const pane = page.locator("[data-mokly-fragment-frame]");
  await expect(pane).toHaveAttribute(
    "src",
    new RegExp(`/static/mokly-generated/${documentPath}/index\\.html$`, "u"),
  );
  const bandBox = await band.boundingBox();
  const paneBox = await pane.boundingBox();
  expect(bandBox && paneBox && bandBox.y < paneBox.y).toBe(true);
}
