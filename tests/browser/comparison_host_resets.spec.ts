/**
 * The comparison band of an embedded viewer under common host resets. The
 * host page adds each reset after the viewer stylesheet: an unlayered element
 * reset, as modern-normalize ships, and a reset in a cascade layer that the
 * host declares after the viewer's rules, as Tailwind's preflight does. The
 * band keeps its padding, the Scroll together track and knob keep the borders
 * that draw them, and Refresh keeps its glyph size.
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

/** The values of the band that a host reset clears when it wins. */
function band(page: Page) {
  return page.locator(".mbk-diff-toolbar").evaluate((toolbar) => {
    const edges = (style: CSSStyleDeclaration) =>
      ["top", "right", "bottom", "left"].map((side) =>
        style.getPropertyValue(`border-${side}-width`),
      );
    const track = toolbar.querySelector(".mbk-diff-sync-track")!;
    const refresh = toolbar.querySelector(".mbk-diff-refresh")!;
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
      refresh: getComputedStyle(refresh).fontSize,
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
      await expect(page.locator(".mbk-diff-refresh")).toBeVisible();
      const drawn = await band(page);
      // Each value differs from the one that a winning reset sets.
      expect(drawn.padding).not.toContain("0px");
      for (const part of [drawn.track, drawn.knob]) {
        expect(part.style).toBe("solid");
        expect(part.widths).not.toContain("0px");
      }
      expect(drawn.refresh).not.toBe(drawn.text);

      await page.addStyleTag({ content: reset });
      expect(await band(page)).toEqual(drawn);
    });
});
