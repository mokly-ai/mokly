import fs from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { SHELL_CSS } from "../../packages/viewer/dist/shell/css.js";

const layouts = [
  '<div class="phone-screen"><iframe class="mbk-frag"></iframe></div>',
  '<div class="browser-viewport"><iframe class="mbk-frag"></iframe></div>',
  '<div class="mbk-stage-embed"><iframe class="mbk-frag"></iframe></div>',
  '<div class="mbk-component-canvas"><iframe class="mbk-frag"></iframe></div>',
  '<div class="mb-pane-doc" data-preview-color-scheme="light"><iframe class="mbk-frag"></iframe></div>',
  '<div class="mbk-diff-screen" data-diff-component><div class="mb-pane-doc" data-preview-color-scheme="light"><iframe class="mbk-frag"></iframe></div></div>',
];

for (const mode of ["standalone", "embedded"] as const) {
  test(`${mode} transparent previews keep their own background across appearance changes`, async ({
    page,
  }) => {
    const css =
      mode === "standalone"
        ? SHELL_CSS
        : await fs.readFile("packages/viewer/dist/styles.css", "utf8");
    await page.setContent(
      `<html data-mokly-theme="light"><head><style>${css}</style></head><body><main class="mokly-viewer" data-mokly-theme="light">${layouts
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
        const surfaces = page.locator(
          ".phone-screen, .browser-viewport, .mb-pane-doc",
        );
        for (const surface of await surfaces.all())
          await expect(surface).toHaveCSS("background-color", background);
      }
    }
  });
}
