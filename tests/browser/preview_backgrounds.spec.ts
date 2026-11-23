import fs from "node:fs/promises";

import { expect } from "@playwright/test";

import { test } from "./browser_test.js";

/** A canvas frame of `kind` around `content`, as `@mokly/ui/canvas-frame` draws it. */
const frame = (kind: string, content: string, side = "") =>
  `<figure class="mbk-canvas-frame mbk-reset" data-canvas-frame="${kind}"${side} data-preview-color-scheme="light"><div class="mbk-canvas-frame-clip mbk-reset"><div class="mbk-canvas-frame-document mbk-reset">${content}</div></div></figure>`;

/**
 * One version of a comparison in its frame's mode, as
 * `@mokly/ui/canvas-comparison` and `@mokly/ui/comparison-pane` draw it: the
 * shared viewport, the version's layer and its opaque surface.
 */
const version = (mode: string, side: string) =>
  `<div class="mbk-frame-compare mbk-reset" data-compare-mode="${mode}"><div class="mb-viewport mbk-reset" data-comparison-viewport=""><div class="mb-viewport-box mbk-reset"><div class="mb-pane mb-pane--${side} mbk-reset"><div class="mb-pane-doc mbk-reset"><iframe class="mbk-frag mbk-reset"></iframe></div></div></div></div></div>`;

/**
 * Preview surfaces as the packages draw them on the canvas, each carrying
 * the reset class: a frame's current document, a stacked comparison's
 * version, and a version of Side by side in its own frame.
 */
const layouts = [
  frame("mobile", '<iframe class="mbk-frag mbk-reset"></iframe>'),
  frame("desktop", version("overlay", "before")),
  frame("component", version("side", "after"), ' data-canvas-side="after"'),
];

for (const mode of ["standalone", "embedded"] as const) {
  test(`${mode} transparent previews keep their own background across appearance changes`, async ({
    page,
  }) => {
    const stylesheet = mode === "standalone" ? "shell.css" : "styles.css";
    const css = await fs.readFile(
      new URL(`../../packages/viewer/dist/${stylesheet}`, import.meta.url),
      "utf8",
    );
    // The standalone stub's document holds the theme, and an embedded root
    // holds its own.
    const documentClass = mode === "standalone" ? ' class="mbk-document"' : "";
    const rootClass =
      mode === "standalone" ? "mokly-viewer" : "mbk mokly-viewer";
    await page.setContent(
      `<html${documentClass} data-mokly-theme="light"><head><style>${css}</style></head><body><main class="${rootClass}" data-mokly-theme="light">${layouts
        .map(
          (layout, index) =>
            `<section id="preview-${index}" data-preview-color-scheme="light">${layout}</section>`,
        )
        .join("")}</main></body></html>`,
    );
    await page.locator("iframe").evaluateAll((frames) => {
      for (const frame of frames as HTMLIFrameElement[])
        frame.srcdoc = "<p>Transparent preview</p>";
    });
    const root = page.locator(mode === "standalone" ? "html" : "main");
    for (const scheme of ["light", "dark"] as const) {
      const background =
        scheme === "light" ? "rgb(255, 255, 255)" : "rgb(18, 21, 20)";
      await page
        .locator("[data-preview-color-scheme]")
        .evaluateAll((surfaces, value) => {
          for (const surface of surfaces)
            surface.setAttribute("data-preview-color-scheme", value);
        }, scheme);
      for (const appearance of ["dark", "light"] as const) {
        await root.evaluate((element, value) => {
          element.setAttribute("data-mokly-theme", value);
        }, appearance);
        for (const index of layouts.keys()) {
          const frame = page.locator(`#preview-${index} iframe`);
          await expect(frame).toHaveCSS("color-scheme", scheme);
          await expect(frame).toHaveCSS("background-color", background);
          await expect(frame.contentFrame().locator("body")).toHaveCSS(
            "background-color",
            "rgba(0, 0, 0, 0)",
          );
        }
        const surfaces = page.locator(".mbk-canvas-frame-clip, .mb-pane-doc");
        for (const surface of await surfaces.all())
          await expect(surface).toHaveCSS("background-color", background);
        for (const viewport of await page.locator(".mb-viewport").all())
          await expect(viewport).toHaveCSS("color-scheme", scheme);
      }
    }
  });
}
