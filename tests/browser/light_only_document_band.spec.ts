/**
 * A copy whose catalogue rendered Light and Dark at the branch point and
 * renders Light only now. Its removed screens keep their dark renders, so the
 * shell still offers Dark, while the current Payment terms document has a
 * light page only. Under Dark a quiet band above the pane names that fallback,
 * as `design/browse/appearance/states/light-only-current` depicts.
 */

import { expect } from "@playwright/test";

import {
  addLightOnlyCurrentSources,
  lightOnlyPaths as paths,
} from "../helpers/light_only_sources.js";

import { additionsCopyTest } from "./additions_copy_test.js";

const test = additionsCopyTest(
  "browser-light-only-current",
  addLightOnlyCurrentSources,
);

for (const width of [1280, 390])
  test(`${width}px: a current light-only document names its light page in a band under Dark`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/view/${paths.currentDocument}/`);
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
      new RegExp(
        `/static/mokly-generated/${paths.currentDocument}/index\\.html$`,
        "u",
      ),
    );
    const bandBox = await band.boundingBox();
    const paneBox = await pane.boundingBox();
    expect(bandBox && paneBox && bandBox.y < paneBox.y).toBe(true);
  });
