import { expect } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

import { changesSummary, firstScreen } from "./changes.js";
import { changesVisible, delivered, observeDelivery } from "./delivery.js";
import { DOCUMENT_FRAME, schemeFrame, viewFrame } from "./frames.js";
import { previewBytes } from "./http.js";
import type { PreparedFixture } from "./setup.js";

/** Verify browser-visible readiness, axes, live props, cached bytes, and a page. */
export async function browse(
  context: BrowserContext,
  url: string,
  fixture: PreparedFixture,
  beginning: number,
  scope: "serve" | "startup" = "serve",
) {
  const page = await context.newPage();
  await observeDelivery(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(`${url}/view/${firstScreen}/`);
  if (!response?.ok())
    throw new Error(`Browse returned HTTP ${response?.status()}`);
  const desktop = page.frameLocator(viewFrame("desktop"));
  await expect(desktop.locator("h1")).toHaveText("Activity 1", {
    timeout: 60_000,
  });
  await expect(desktop.locator('[role="row"]')).toHaveCount(fixture.size.rows);
  await expect(
    page.locator('[data-entry-id="area-1/screens/activity-group-1/screen-1"]'),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("activity 2");
  await expect(
    page.locator('[data-entry-id="area-1/screens/activity-group-1/screen-2"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-entry-id="area-1/screens/activity-group-1/screen-1"]'),
  ).toBeHidden();
  const usableMs = performance.now() - beginning;
  await page.getByRole("searchbox").fill("");
  const comparison =
    scope === "serve" ? await changesReadiness(page, fixture, beginning) : {};
  for (const viewport of ["desktop", "mobile"] as const) {
    await page.getByLabel("Viewport", { exact: true }).selectOption(viewport);
    for (const scheme of ["dark", "light"] as const) {
      await page.getByLabel("Appearance", { exact: true }).selectOption(scheme);
      // The canvas shows each scheme in its own frame.
      const frame = page.frameLocator(schemeFrame(viewport, scheme));
      await expect(frame.locator("html")).toHaveAttribute(
        "style",
        new RegExp(`color-scheme: ${scheme}`),
        { timeout: 60_000 },
      );
      await expect(frame.locator("h1")).toHaveText("Activity 1");
      await expect(frame.locator("body")).toHaveCSS(
        "background-color",
        scheme === "dark" ? "rgb(24, 37, 31)" : "rgb(247, 248, 246)",
      );
    }
  }
  const src = await page.locator(viewFrame("mobile")).getAttribute("src");
  if (!src) throw new Error("Preview has no URL");
  const cached = performance.now();
  const bytes = await previewBytes(new URL(src, url));
  const cachedPreviewMs = performance.now() - cached;
  await page.goto(`${url}/view/area-1/components/action/`);
  await page.getByLabel("Viewport", { exact: true }).selectOption("desktop");
  await page.getByRole("tab", { name: "Props", exact: true }).click();
  const edited = performance.now();
  await page.getByLabel("label", { exact: true }).fill("Benchmark action");
  // The component's own example comes first in its variant set.
  await expect(
    page
      .frameLocator(viewFrame("desktop"))
      .first()
      .getByRole("button", { name: "Benchmark action" }),
  ).toBeVisible({ timeout: 60_000 });
  const propsMs = performance.now() - edited;
  await page.goto(`${url}/view/area-1/guide/`);
  await expect(
    page
      .frameLocator(DOCUMENT_FRAME)
      .getByRole("heading", { name: "Getting started" }),
  ).toBeVisible({ timeout: 60_000 });
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
  return {
    usableMs,
    propsMs,
    cachedPreviewMs,
    bytes,
    ...comparison,
  };
}

async function changesReadiness(
  page: Page,
  fixture: PreparedFixture,
  beginning: number,
) {
  const current = await delivered(page);
  await changesVisible(page, current.index);
  const changesReadyMs = performance.now() - beginning;
  return { changesReadyMs, summary: changesSummary(fixture, current) };
}
