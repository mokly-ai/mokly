/**
 * Capture every published route, including the documentation, at both
 * inspection viewports in both schemes. Name routes to capture only those.
 * The captures are a development aid for comparing the built site with the
 * mockups; they are not part of any check.
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";
import { preview } from "astro";

import { DOCS_PAGES } from "../src/docs/pages.ts";
import { NOT_FOUND_ROUTE, PAGE_METADATA } from "../src/metadata.ts";

const [, , directory, ...only] = process.argv;
if (!directory) throw new Error("Usage: capture.mjs <directory> [route ...]");
await mkdir(directory, { recursive: true });

const port = Number(process.env["MOKLY_SITE_CAPTURE_PORT"] ?? 4613);
const server = await preview({ server: { host: "127.0.0.1", port } });
const browser = await chromium.launch({
  channel: process.env["PLAYWRIGHT_CHANNEL"] ?? "chrome",
});
try {
  for (const width of [390, 1440]) {
    for (const colorScheme of /** @type {const} */ (["light", "dark"])) {
      const context = await browser.newContext({
        colorScheme,
        viewport: { height: 900, width },
      });
      const page = await context.newPage();
      const routes = only.length
        ? only
        : [
            ...Object.keys(PAGE_METADATA),
            ...DOCS_PAGES.map((page) => page.route),
          ];
      for (const route of routes) {
        if (route === NOT_FOUND_ROUTE) continue;
        await page.goto(`http://127.0.0.1:${port}${route}`);
        await page.waitForLoadState("networkidle");
        const name =
          route === "/" ? "home" : route.split("/").filter(Boolean).join("-");
        await page.screenshot({
          fullPage: true,
          path: path.join(directory, `${name}-${width}-${colorScheme}.png`),
        });
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.stop();
}
