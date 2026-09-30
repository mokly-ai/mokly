/** Browser assertions run before complete Changes delivery, independently of worker timing. */
import { expect } from "@playwright/test";

import { waitFor } from "./process.mjs";

export async function measureInteractive(
  page,
  running,
  fixture,
  beginning,
  measured,
) {
  const match = await waitFor(
    running,
    /Mokly listening at (http:\/\/127\.0\.0\.1:\d+)/,
  );
  const url = match[1];
  const readinessMs = Math.round(performance.now() - beginning);
  Object.assign(measured, { url, beginning, readinessMs });
  await page.goto(url + "/view/screens/area-1-screen-1.html");
  const desktop = page.frameLocator('[data-workspace-frame="desktop"]');
  await expect(desktop.locator("h1")).toHaveText("Activity 1");
  await expect(desktop.locator('[role="row"]')).toHaveCount(fixture.size.rows);
  await page.getByRole("searchbox").fill("activity 2");
  await expect(page.locator('[data-entry-id="area-1-screen-1"]')).toBeHidden();
  const usableMs = Math.round(performance.now() - beginning);
  measured.usableMs = usableMs;
  await page.getByRole("searchbox").fill("");
  for (const viewport of ["desktop", "mobile"]) {
    await page.getByLabel("Viewport", { exact: true }).selectOption(viewport);
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
      const frame = page.frameLocator(`[data-workspace-frame="${viewport}"]`);
      await expect(frame.locator("html")).toHaveAttribute(
        "data-color-scheme",
        scheme,
      );
      await expect(frame.locator("h1")).toHaveText("Activity 1");
    }
  }
  await page.goto(url + "/view/components/area-1-action-default.html");
  await page.getByLabel("Viewport", { exact: true }).selectOption("desktop");
  await page.getByRole("tab", { name: "Props", exact: true }).click();
  const edited = performance.now();
  await page.getByLabel("label", { exact: true }).fill("Benchmark action");
  await expect(
    page
      .frameLocator('[data-workspace-frame="desktop"]')
      .getByRole("button", { name: "Benchmark action" }),
  ).toBeVisible({ timeout: 10000 });
  const propsMs = Math.round(performance.now() - edited);
  measured.propsMs = propsMs;
  const cached = performance.now();
  const response = await fetch(
    url + "/static/screens/area-1-screen-1.desktop.html",
  );
  if (!response.ok) throw new Error(`Cached preview: HTTP ${response.status}`);
  const bytes = (await response.arrayBuffer()).byteLength;
  const cachedPreviewMs = Math.round(performance.now() - cached);
  Object.assign(measured, { cachedPreviewMs, bytes });
  await page.goto(url + "/view/pages/area-1-guide.html");
  await expect(
    page
      .frameLocator(".mbk-stage-embed iframe")
      .getByRole("heading", { name: "Getting started" }),
  ).toBeVisible();
  Object.assign(measured, {
    readinessMs,
    usableMs,
    propsMs,
    cachedPreviewMs,
    bytes,
  });
}
