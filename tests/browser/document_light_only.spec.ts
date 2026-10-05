import { expect, test } from "@playwright/test";

import { scaledTimeLimit } from "../helpers/time_limits.js";

import {
  startLightOnlyDocument,
  type LightOnlyDocumentHost,
} from "./light_only_document_fixture.js";

let served: LightOnlyDocumentHost;

test.beforeAll(async () => {
  test.setTimeout(scaledTimeLimit(180_000));
  served = await startLightOnlyDocument();
});

test.afterAll(async () => {
  if (served) await served.close();
});

for (const width of [390, 1280])
  test(`${width}px: a removed document with no dark render keeps its light version and names it only under Dark`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${served.url}/view/guide/old-terms/`);
    const appearance = page.getByLabel("Appearance", { exact: true });
    const label = page.locator(".mbk-previous");
    const note = label.locator(".mbk-frame-scheme-note");
    const stage = page.locator(".mbk-stage-embed[data-preview-color-scheme]");
    const heading = page
      .frameLocator("iframe[data-mokly-preview-frame]")
      .getByRole("heading", { name: "Old terms", exact: true });

    await appearance.selectOption("light");
    await expect(heading).toBeVisible();
    await expect(label).toHaveText(/^Showing previous version/u);
    await expect(note).toBeHidden();
    await expect(page.locator(".mbk-scheme-fallback")).toHaveCount(0);

    await appearance.selectOption("dark");
    await expect(note).toBeVisible();
    await expect(label).toHaveText("Showing previous version — Light only");
    await expect(stage).toHaveAttribute("data-preview-color-scheme", "light");
    await expect(heading).toBeVisible();

    await appearance.selectOption("light");
    await expect(note).toBeHidden();
    await expect(heading).toBeVisible();
  });
