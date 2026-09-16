/**
 * Capture every published route at both inspection viewports in both schemes.
 * The captures are a development aid for comparing the built site with the
 * mockups; they are not part of any check.
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";
import { preview } from "astro";

import { NOT_FOUND_ROUTE, PAGE_METADATA } from "../src/metadata.ts";

const directory = process.argv[2];
if (!directory) throw new Error("Usage: capture.mjs <directory>");
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
      for (const route of Object.keys(PAGE_METADATA)) {
        if (route === NOT_FOUND_ROUTE) continue;
        await page.goto(`http://127.0.0.1:${port}${route}`);
        await page.waitForLoadState("networkidle");
        const name = route === "/" ? "home" : route.replaceAll("/", "");
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
