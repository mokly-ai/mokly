/**
 * The comparison band of an embedded viewer under common host resets. The
 * host page adds each reset after the viewer stylesheet: an unlayered element
 * reset, as modern-normalize ships, and a reset in a cascade layer that the
 * host declares after the viewer's rules, as Tailwind's preflight does. The
 * band keeps its padding, the Scroll together track and knob keep the borders
 * that draw them, and Refresh keeps the drawn size of its glyph.
 */

import { expect, type Page } from "@playwright/test";

import { scrollTogether } from "./comparison_scroll.js";
import { comparisonPaths, test } from "./comparison_test.js";
import {
  comparisonViewerHost,
  openEmbeddedComparison,
  type ComparisonViewerHost,
} from "./comparison_viewer_host.js";

const RESETS = {
  "an unlayered element reset": "button { font-size: 100%; padding: 0; }",
  "a host layer declared after the viewer":
    "@layer base { *, ::after { padding: 0; border: 0 solid; } }",
};

/**
 * The values of the band that a host reset clears when it wins, read through
 * its hooks: the band holds the `Comparison mode` group, the label of the
 * `Scroll together` switch, which draws its track, and Refresh.
 */
function band(page: Page) {
  return page
    .getByRole("group", { name: "Comparison mode" })
    .evaluate((modes) => {
      const toolbar = modes.parentElement!;
      const edges = (style: CSSStyleDeclaration) =>
        ["top", "right", "bottom", "left"].map((side) =>
          style.getPropertyValue(`border-${side}-width`),
        );
      const track = toolbar
        .querySelector('[role="switch"]')!
        .closest("label")!
        .querySelector('[aria-hidden="true"]')!;
      const glyph = toolbar
        .querySelector("[data-diff-refresh] svg")!
        .getBoundingClientRect();
      const style = getComputedStyle(toolbar);
      return {
        padding: [
          style.paddingTop,
          style.paddingRight,
          style.paddingBottom,
          style.paddingLeft,
        ],
        track: {
          style: getComputedStyle(track).borderTopStyle,
          widths: edges(getComputedStyle(track)),
        },
        knob: {
          style: getComputedStyle(track, "::after").borderTopStyle,
          widths: edges(getComputedStyle(track, "::after")),
        },
        refresh: `${glyph.width}x${glyph.height}`,
        text: style.fontSize,
      };
    });
}

test.describe("embedded viewer", () => {
  let host: ComparisonViewerHost;
  test.beforeAll(async () => {
    host = await comparisonViewerHost();
  });
  test.afterAll(async () => {
    await host?.close();
  });

  for (const [name, reset] of Object.entries(RESETS))
    test(`${name} leaves the comparison band as the viewer draws it`, async ({
      page,
    }) => {
      await openEmbeddedComparison(
        page,
        `${host.url}/viewer.html?adapter=same-origin&entry=${comparisonPaths.changed}`,
        "desktop",
        "Overlay",
      );
      await expect(scrollTogether(page)).toBeChecked();
      await expect(
        page.getByRole("button", { name: "Refresh comparison", exact: true }),
      ).toBeVisible();
      const drawn = await band(page);
      // Each value differs from the one that a winning reset sets.
      expect(drawn.padding).not.toContain("0px");
      for (const part of [drawn.track, drawn.knob]) {
        expect(part.style).toBe("solid");
        expect(part.widths).not.toContain("0px");
      }
      expect(drawn.refresh).not.toBe("0x0");

      await page.addStyleTag({ content: reset });
      expect(await band(page)).toEqual(drawn);
    });
});
