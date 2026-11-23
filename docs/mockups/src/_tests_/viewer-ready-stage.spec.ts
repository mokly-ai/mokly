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
import { canvasFrameViolations } from "./viewer-measures";

/**
 * The ready canvas of a branch's publication: the frames of the current
 * screen with the view that each shows, the right panel, the compact
 * layout's entry bar and dock, and the package's search in the bar, each
 * control a native control or a picture of itself. The chrome around every
 * viewer screen is checked in `viewer.spec.ts`.
 */

/**
 * The frames that the ready canvas shows of Home in each document, by name,
 * with the scheme of the view that each shows. Home is drawn in light and
 * dark, so Mokly publishes both views in each viewport. A desktop document
 * shows all four frames, each in its own scheme whatever the document's
 * scheme is, so no frame keeps a light view that `Light only` would name. A
 * phone shows the compact layout's one frame, the mobile frame of the
 * document's scheme, named after the screen's slug.
 */
const readyFrames = {
  "desktop light": [
    ["Desktop · Light", "light"],
    ["Mobile · Light", "light"],
    ["Desktop · Dark", "dark"],
    ["Mobile · Dark", "dark"],
  ],
  "desktop dark": [
    ["Desktop · Light", "light"],
    ["Mobile · Light", "light"],
    ["Desktop · Dark", "dark"],
    ["Mobile · Dark", "dark"],
  ],
  "mobile light": [["home · Mobile · Light", "light"]],
  "mobile dark": [["home · Mobile · Dark", "dark"]],
} as const satisfies Record<string, readonly (readonly [string, Scheme])[]>;

/** The size of Mokly's canvas frame of each viewport, the drawing's documents. */
const frameDocument = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const;

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
      "the ready canvas renders the published catalogue: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(url);
        const viewer = page.locator(".mokly-viewer");
        await expect(viewer).toBeVisible();
        // Each frame records the scheme of the view it shows, and its sample
        // paints that view's palette, whatever the document's scheme is.
        const frames = viewer.locator("[data-mokly-stage] [data-canvas-frame]");
        const expected = readyFrames[label];
        await expect(frames).toHaveCount(expected.length);
        for (const [name, shown] of expected) {
          const frame = viewer
            .locator("[data-mokly-stage]")
            .getByRole("figure", { name });
          await expect(frame, name).toHaveAttribute(
            "data-preview-color-scheme",
            shown,
          );
          const palette = paletteColors(shown);
          const screen = frame.locator(
            '[data-mkc-sample-screen="' + currentScreen.path + '"]',
          );
          await expect(screen, name).toBeVisible();
          await expect(screen, name).toHaveCSS(
            "background-color",
            rgb(palette.surface),
          );
          await expect(screen, name).toHaveCSS("color", rgb(palette.text));
        }
        await expect(
          viewer.getByText("Light only").filter({ visible: true }),
        ).toHaveCount(0);
        // The workspace runs no script: every control that it draws is a
        // native control or a picture of itself.
        const workspace = viewer.locator("[data-workspace]");
        await expect(
          workspace.getByRole("button", { includeHidden: true }),
        ).toHaveCount(0);
        if (viewport === "desktop") {
          await expect(
            viewer.getByRole("group", { name: "Zoom" }).getByRole("img"),
          ).toHaveCount(3);
          // The right panel shows Inspect, the current tab, beside Changes,
          // and Inspect's head and Frames filter name the screen's frames.
          const panel = viewer.getByRole("region", { name: "Panel" });
          await expect(
            panel.getByRole("img", { name: "Inspect" }),
          ).toHaveAttribute("aria-current", "true");
          await expect(
            panel.getByRole("img", { name: "Changes" }),
          ).toBeVisible();
          await expect(
            panel.getByRole("heading", { level: 2, name: "Home" }),
          ).toBeVisible();
          const filter = panel.getByRole("group", { name: "Frames" });
          for (const toggle of ["Mobile", "Desktop", "Light", "Dark"])
            await expect(
              filter.getByRole("checkbox", { name: toggle }),
            ).toBeChecked();
        } else {
          // The compact layout picks the frame in the entry bar and holds
          // Catalogue, the panel's tab and Fit in its dock.
          await expect(
            viewer
              .getByRole("combobox", { name: "Frame" })
              .getByRole("option", { selected: true }),
          ).toHaveText(scheme === "dark" ? "Mobile · Dark" : "Mobile · Light");
          const dock = viewer.getByRole("group", { name: "Canvas controls" });
          for (const control of ["Catalogue", "Inspect", "Fit"])
            await expect(
              dock.getByRole("img", { name: control }),
            ).toBeVisible();
        }
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
        // At 390px the package's search field is its own search button, as
        // in the app, and a wider bar shows the field in its place.
        const search = viewer.getByRole("button", {
          name: "Search catalogue",
          exact: true,
        });
        const field = viewer.getByRole("searchbox", {
          name: "Search catalogue",
        });
        await expect(search).toBeVisible({ visible: viewport === "mobile" });
        await expect(field).toBeVisible({ visible: viewport === "desktop" });
      },
    );

    test(
      "the ready canvas holds its frames clear of its floating controls in Mokly's frame: " +
        label,
      async ({ page }) => {
        await page.setViewportSize(frameDocument[viewport]);
        await page.goto(url);
        await expect
          .poll(() => page.evaluate(canvasFrameViolations))
          .toEqual([]);
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
