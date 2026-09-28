/** Browser-visible startup is the acceptance boundary, not a listening socket. */
import os from "node:os";
import path from "node:path";

import { chromium, expect } from "@playwright/test";

import { loadConfig } from "../../dist/config/load.js";

import { resetFixtureBaseline } from "./baseline.mjs";
import { waitForBrowseChanges } from "./browse.mjs";
import { start, stop, waitFor } from "./process.mjs";
import {
  classificationScenarios,
  prepareClassificationScenario,
} from "./scenarios.mjs";
import { baselineMeasurement, classificationMeasurement } from "./timings.mjs";

export async function benchmark(repository, fixture) {
  const config = await loadConfig(fixture.root, fixture.configPath);
  const derived = config.generatedOutput === "derived";
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
  });
  const runs = [];
  const measurementFailures = [];
  const targetFailures = [];
  try {
    for (const definition of classificationScenarios) {
      const scenario = await prepareClassificationScenario(
        repository,
        fixture,
        definition.name,
      );
      if (derived) await resetFixtureBaseline(config);
      for (const state of ["cold", "warm"]) {
        const page = await browser.newPage({
          viewport: { width: 1440, height: 1000 },
        });
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const beginning = performance.now();
        const running = start(
          [
            path.join(repository, "dist/cli/bin.js"),
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
        let measured;
        try {
          const match = await waitFor(
            running,
            /Mokly listening at (http:\/\/127\.0\.0\.1:\d+)/,
          );
          const url = match[1];
          const readinessMs = Math.round(performance.now() - beginning);
          await page.goto(url + "/view/area-1/screens/activity-1.html");
          const desktop = page.frameLocator('[data-workspace-frame="desktop"]');
          await expect(desktop.locator("h1")).toHaveText("Activity 1");
          await expect(desktop.locator('[role="row"]')).toHaveCount(
            fixture.size.rows,
          );
          await page.getByRole("searchbox").fill("activity 2");
          await expect(
            page.locator('[data-entry-id="area-1-screen-1"]'),
          ).toBeHidden();
          const usableMs = Math.round(performance.now() - beginning);
          await page.getByRole("searchbox").fill("");
          for (const viewport of ["desktop", "mobile"]) {
            await page
              .getByLabel("Viewport", { exact: true })
              .selectOption(viewport);
            for (const scheme of ["dark", "light"]) {
              const toggle = page.locator("[data-workspace-scheme]");
              if (await toggle.count()) {
                if (
                  (await toggle.getAttribute("aria-pressed")) !==
                  String(scheme === "dark")
                )
                  await toggle.click();
              } else
                await page
                  .getByLabel("Appearance", { exact: true })
                  .selectOption(scheme);
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
          await page.goto(url + "/view/area-1/components/action.html");
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
            url + "/static/area-1/screens/activity-1.desktop.html",
          );
          if (!response.ok)
            throw new Error(`Cached preview: HTTP ${response.status}`);
          const bytes = (await response.arrayBuffer()).byteLength;
          const cachedPreviewMs = Math.round(performance.now() - cached);
          await page.goto(url + "/view/area-1/guide.html");
          await expect(
            page
              .frameLocator(".mbk-stage-embed iframe")
              .getByRole("heading", { name: "Getting started" }),
          ).toBeVisible();
          measured = {
            scenario: scenario.name,
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
          if (usableMs >= 5000)
            targetFailures.push(
              `${scenario.name}/${state} usable startup exceeded 5 seconds: ${usableMs}ms`,
            );
          await waitForBrowseChanges(
            url,
            fixture.size.inlineStyles ? 900_000 : undefined,
          );
          const classified = await (await fetch(url)).text();
          const changedRoutes = scenario.expectedChanges;
          expect(classified).toContain(
            `class="mbk-nav-filter-count">${changedRoutes}<`,
          );
          const changesReadyMs = Math.round(performance.now() - beginning);
          expect(errors).toEqual([]);
          const classification = classificationMeasurement(running.timings);
          const baseline = derived
            ? baselineMeasurement(running.timings, beginning, state === "warm")
            : {};
          runs.push({
            ...measured,
            changesReadyMs,
            changedRoutes,
            ...classification,
            ...baseline,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown benchmark error";
          let classification = {};
          try {
            classification = {
              ...classificationMeasurement(running.timings, "error"),
              classificationStatus: "error",
            };
          } catch {
            // The failure happened before background classification completed.
          }
          const failure = {
            scenario: scenario.name,
            state,
            ...measured,
            expectedChangedRoutes: scenario.expectedChanges,
            ...classification,
            error: message,
          };
          runs.push(failure);
          measurementFailures.push(`${scenario.name}/${state}: ${message}`);
          process.stdout.write(
            `Benchmark sample failed ${JSON.stringify(failure)}\n`,
          );
        } finally {
          await stop(running);
          await page.close();
          process.off("SIGINT", forward);
          process.off("SIGTERM", forward);
        }
      }
    }
  } finally {
    await browser.close();
  }
  const result = {
    ...fixture,
    classificationComplete: measurementFailures.length === 0,
    generatedOutput: config.generatedOutput,
    machine: machineDetails(),
    targetHeld: targetFailures.length === 0,
    runs,
  };
  process.stdout.write(`Benchmark ${JSON.stringify(result)}\n`);
  const failures = [...measurementFailures, ...targetFailures];
  if (failures.length)
    throw new Error(`Benchmark failed:\n${failures.join("\n")}`);
}

function machineDetails() {
  const cpus = os.cpus();
  return {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    cpu: cpus[0]?.model ?? "unknown",
    logicalCpus: cpus.length,
    memoryGiB: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
  };
}
