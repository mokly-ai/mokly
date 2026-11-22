import { pathToFileURL } from "node:url";

import { paletteColors } from "@mokly-cloud/tokens/palettes";
import { expect, test } from "@playwright/test";

import { sample } from "../fixtures/product";
import { publication } from "../fixtures/publications";
import { currentScreen } from "../fixtures/viewer-catalogue";

import { screenFile } from "./catalogue-paths";
import type { Scheme } from "./catalogue-paths";
import { rgb } from "./color-metrics";
import {
  controlDocumentViolations,
  controlPolicyInput,
} from "./controls-document-policy";

/**
 * The ready stage of a branch's publication: the view of the current screen
 * that each frame shows, and the view controls above the stage. The chrome
 * around every viewer screen is checked in `viewer.spec.ts`.
 */

/** Each viewport's device frame on the ready stage. */
const devices = [
  ["mobile", ".phone-frame"],
  ["desktop", ".browser-frame"],
] as const;

/**
 * What the ready stage shows of Home in each document. Home is drawn in light
 * and dark, so Mokly publishes both views in each viewport. Under Dark
 * each frame therefore shows its dark view, and no frame keeps a light view
 * that the package's Light only note would name. Only the mobile document's
 * stage shows the phone. Every view of Home changed, so each document hides a
 * changed view in the other viewport and one in the other scheme: `marks`
 * holds the description that the viewer then gives the Viewport select and
 * the Dark preview switch.
 */
const readyStage = {
  "desktop light": {
    mobile: "light",
    desktop: "light",
    lightOnly: 0,
    marks: ["Other viewport changed", "Other theme changed"],
  },
  "desktop dark": {
    mobile: "dark",
    desktop: "dark",
    lightOnly: 0,
    marks: ["Other viewport changed", "Other theme changed"],
  },
  "mobile light": {
    mobile: "light",
    desktop: "light",
    lightOnly: 0,
    marks: ["Other viewport changed", "Other theme changed"],
  },
  "mobile dark": {
    mobile: "dark",
    desktop: "dark",
    lightOnly: 0,
    marks: ["Other viewport changed", "Other theme changed"],
  },
} as const satisfies Record<
  string,
  Record<"mobile" | "desktop", Scheme> & {
    lightOnly: number;
    marks: readonly [viewport: string, scheme: string];
  }
>;

for (const viewport of ["desktop", "mobile"] as const)
  for (const scheme of ["light", "dark"] as const) {
    const url = pathToFileURL(
      screenFile("product/viewer/standalone", viewport, scheme),
    ).href;
    const label = `${viewport} ${scheme}` as const;
    const size = {
      width: viewport === "mobile" ? 390 : 1440,
      height: viewport === "mobile" ? 844 : 900,
    };

    test(
      "the ready stage renders the published catalogue: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(url);
        const viewer = page.locator(".mokly-viewer");
        await expect(viewer).toBeVisible();
        await expect(
          viewer.getByRole("heading", { name: "Home" }),
        ).toBeVisible();
        // The selected viewport's device frame shows the current screen.
        await expect(
          viewer
            .locator(
              "[data-mokly-stage] " +
                (viewport === "mobile" ? ".phone-frame" : ".browser-frame"),
            )
            .locator('[data-mkc-sample-screen="' + currentScreen.path + '"]'),
        ).toBeVisible();
        // Each frame records the scheme of the view it shows, and its sample
        // paints that view's palette, whatever the document's scheme is.
        const stage = viewer.locator("[data-mokly-stage]");
        const expected = readyStage[label];
        for (const [frameViewport, device] of devices) {
          const frame = stage
            .locator("[data-preview-color-scheme]")
            .filter({ has: page.locator(device) });
          const shown = expected[frameViewport];
          await expect(frame, frameViewport).toHaveAttribute(
            "data-preview-color-scheme",
            shown,
          );
          const palette = paletteColors(shown);
          const screen = frame.locator(
            '[data-mkc-sample-screen="' + currentScreen.path + '"]',
          );
          await expect(screen, frameViewport).toHaveCSS(
            "background-color",
            rgb(palette.surface),
          );
          await expect(screen, frameViewport).toHaveCSS(
            "color",
            rgb(palette.text),
          );
        }
        await expect(
          stage.getByText("Light only").filter({ visible: true }),
        ).toHaveCount(expected.lightOnly);
        // The Dark preview toggle keeps the scheme the reader asked for, and
        // each view control describes the changed view it hides.
        const controls = viewer.getByRole("group", { name: "View options" });
        const darkPreview = controls.getByRole("switch", {
          name: "Dark preview",
        });
        const [viewportMark, schemeMark] = expected.marks;
        await expect(darkPreview).toBeChecked({ checked: scheme === "dark" });
        await expect(darkPreview).toHaveAccessibleDescription(schemeMark);
        await expect(
          controls.getByRole("combobox", { name: "Viewport" }),
        ).toHaveAccessibleDescription(viewportMark);
        await expect(
          page.getByRole("heading", { level: 1, includeHidden: true }),
        ).toHaveText(sample.project + " · " + publication.branch);
        if (viewport === "desktop")
          await expect(
            page.getByText(publication.sha, { exact: true }),
          ).toBeVisible();
        await expect(
          page.getByRole("button", { name: publication.branch }),
        ).toBeVisible();
      },
    );
  }

test("History's glyph form keeps its name and its tooltip, which the control policy checks", async ({
  page,
}) => {
  const input = controlPolicyInput(false);
  const url = pathToFileURL(
    screenFile("product/viewer/standalone", "desktop"),
  ).href;
  for (const [part, problem] of [
    ["aria-label", "action label required"],
    ["title", "icon-only action needs its name as its tooltip"],
  ] as const) {
    await page.goto(url);
    expect(await page.evaluate(controlDocumentViolations, input)).toEqual([]);
    await page
      .locator('[title="History"] [aria-label="History"]')
      .evaluate(
        (node, name) =>
          (name === "title" ? node.closest("[title]") : node)?.removeAttribute(
            name,
          ),
        part,
      );
    expect(await page.evaluate(controlDocumentViolations, input)).toContain(
      problem,
    );
  }
});
