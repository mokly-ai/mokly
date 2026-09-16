/**
 * Measure the built site against the Lighthouse budget in
 * `docs/protocol/site-delivery.md`. The site is served from `dist` by Astro's
 * preview API, every audited route is measured at both inspection viewports,
 * and the run exits non-zero naming each category that missed its threshold.
 */

import { preview } from "astro";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

import {
  AUDITED,
  CATEGORIES,
  THRESHOLDS,
  VIEWPORTS,
  budgetTable,
  shortfalls,
} from "../src/lighthouse.ts";

const port = Number(process.env["MOKLY_SITE_LIGHTHOUSE_PORT"] ?? 4612);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error(
    "MOKLY_SITE_LIGHTHOUSE_PORT must be an available TCP port (1–65535)",
  );
}

/** Chrome is the same browser the browser checks drive. */
const CHROME_FLAGS = [
  "--headless=new",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

const server = await preview({ server: { host: "127.0.0.1", port } });
const chrome = await chromeLauncher.launch({
  chromeFlags: CHROME_FLAGS,
  chromePath: process.env["CHROME_PATH"] ?? "/usr/bin/google-chrome",
});

/** @type {import("../src/lighthouse.ts").Measurement[]} */
const measurements = [];
try {
  for (const route of AUDITED) {
    for (const viewport of VIEWPORTS) {
      const result = await lighthouse(
        `http://127.0.0.1:${port}${route}`,
        { logLevel: "silent", output: "json", port: chrome.port },
        {
          extends: "lighthouse:default",
          settings: {
            formFactor: viewport.formFactor,
            screenEmulation: {
              deviceScaleFactor: viewport.formFactor === "mobile" ? 3 : 1,
              disabled: false,
              height: viewport.height,
              mobile: viewport.formFactor === "mobile",
              width: viewport.width,
            },
            ...(viewport.throttling ? { throttling: viewport.throttling } : {}),
            throttlingMethod: "simulate",
          },
        },
      );
      const categories = result?.lhr.categories ?? {};
      measurements.push({
        route,
        scores: Object.fromEntries(
          CATEGORIES.map((category) => [
            category,
            categories[category]?.score ?? 0,
          ]),
        ),
        viewport: viewport.label,
      });
    }
  }
} finally {
  chrome.kill();
  await server.stop();
}

process.stdout.write(`${budgetTable(measurements).join("\n")}\n`);
const failed = measurements.filter(
  (measurement) => shortfalls(measurement).length > 0,
);
if (failed.length > 0) {
  for (const measurement of failed) {
    for (const category of shortfalls(measurement)) {
      process.stderr.write(
        `site:lighthouse ${measurement.route} at ${measurement.viewport}px scored ${(measurement.scores[category] ?? 0).toFixed(2)} for ${category}, under the ${THRESHOLDS[category]} threshold.\n`,
      );
    }
  }
  process.exitCode = 1;
}
