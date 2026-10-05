/** Browser-visible startup is the acceptance boundary, not a listening socket. */
import path from "node:path";

import { chromium, expect } from "@playwright/test";

import { loadConfig } from "../../dist/config/load.js";
import { cliPackageRoot } from "../package/layout.mjs";

import { resetFixtureBaseline } from "./baseline.mjs";
import { expectedStylesheetChanges, waitForBrowseChanges } from "./browse.mjs";
import { start, stop, waitFor } from "./process.mjs";
import { baselineMeasurement } from "./timings.mjs";

export async function benchmark(repository, fixture) {
  const config = await loadConfig(fixture.root, fixture.configPath);
  const derived = config.generatedOutput === "derived";
  if (derived) await resetFixtureBaseline(config);
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
  });
  const runs = [];
  try {
    for (const state of ["cold", "warm"]) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const beginning = performance.now();
      const running = start(
        [
          path.join(cliPackageRoot(repository), "dist/cli/bin.js"),
          "serve",
          "--config",
          fixture.configPath,
          "--port",
          "0",
          "--debug-timings",
        ],
        fixture.root,
      );
      const forward = () => void stop(running);
      process.once("SIGINT", forward);
      process.once("SIGTERM", forward);
      try {
        const match = await waitFor(
          running,
          /Mokly listening at (http:\/\/127\.0\.0\.1:\d+)/,
        );
        const url = match[1];
        const readinessMs = Math.round(performance.now() - beginning);
        await page.goto(
          url + "/view/area-1/screens/activity-group-1/screen-1/",
        );
        const desktop = page.frameLocator('[data-workspace-frame="desktop"]');
        await expect(desktop.locator("h1")).toHaveText("Activity 1");
        await expect(desktop.locator('[role="row"]')).toHaveCount(
          fixture.size.rows,
        );
        await page.getByRole("searchbox").fill("activity 2");
        await expect(
          page.locator(
            '[data-entry-id="area-1/screens/activity-group-1/screen-1"]',
          ),
        ).toBeHidden();
        const usableMs = Math.round(performance.now() - beginning);
        await page.getByRole("searchbox").fill("");
        for (const viewport of ["desktop", "mobile"]) {
          await page
            .getByLabel("Viewport", { exact: true })
            .selectOption(viewport);
          for (const scheme of ["dark", "light"]) {
            const toggle = page.locator("[data-workspace-scheme]");
            if (
              (await toggle.getAttribute("aria-pressed")) !==
              String(scheme === "dark")
            )
              await toggle.click();
            const frame = page.frameLocator(
              `[data-workspace-frame="${viewport}"]`,
            );
            await expect(frame.locator("html")).toHaveAttribute(
              "data-color-scheme",
              scheme,
            );
            await expect(frame.locator("h1")).toHaveText("Activity 1");
          }
        }
        await page.goto(url + "/view/area-1/components/action/");
        await page
          .getByLabel("Viewport", { exact: true })
          .selectOption("desktop");
        await page.getByRole("tab", { name: "Props", exact: true }).click();
        const edited = performance.now();
        await page
          .getByLabel("label", { exact: true })
          .fill("Benchmark action");
        await expect(
          page
            .frameLocator('[data-workspace-frame="desktop"]')
            .getByRole("button", { name: "Benchmark action" }),
        ).toBeVisible({ timeout: 10000 });
        const propsMs = Math.round(performance.now() - edited);
        const cached = performance.now();
        const response = await fetch(
          url +
            "/static/area-1/screens/activity-group-1/screen-1/index.desktop.html",
        );
        if (!response.ok)
          throw new Error(`Cached preview: HTTP ${response.status}`);
        const bytes = (await response.arrayBuffer()).byteLength;
        const cachedPreviewMs = Math.round(performance.now() - cached);
        await page.goto(url + "/view/area-1/guide/");
        await expect(
          page
            .frameLocator(".mbk-stage-embed iframe")
            .getByRole("heading", { name: "Getting started" }),
        ).toBeVisible();
        const measured = {
          state,
          readinessMs,
          usableMs,
          propsMs,
          cachedPreviewMs,
          bytes,
        };
        process.stdout.write(
          `Interactive benchmark ${JSON.stringify(measured)}\n`,
        );
        await waitForBrowseChanges(url);
        const classified = await (await fetch(url)).text();
        const changedEntries = expectedStylesheetChanges;
        expect(classified).toContain(
          `class="mbk-nav-filter-count">${changedEntries}<`,
        );
        const changesReadyMs = Math.round(performance.now() - beginning);
        expect(errors).toEqual([]);
        const baseline = derived
          ? baselineMeasurement(running.timings, beginning, state === "warm")
          : {};
        runs.push({ ...measured, changesReadyMs, changedEntries, ...baseline });
        if (usableMs >= 5000)
          throw new Error(
            `${state} usable startup exceeded 5 seconds: ${usableMs}ms`,
          );
      } finally {
        await stop(running);
        await page.close();
        process.off("SIGINT", forward);
        process.off("SIGTERM", forward);
      }
    }
  } finally {
    await browser.close();
  }
  process.stdout.write(
    `Benchmark ${JSON.stringify({ ...fixture, generatedOutput: config.generatedOutput, runs })}\n`,
  );
}
