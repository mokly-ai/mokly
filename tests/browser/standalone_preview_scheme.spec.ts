import { expect, test, type Page } from "@playwright/test";

import { exportCatalogue } from "../../dist/export/run.js";
import { createExportFixture } from "../helpers/export_fixture.js";
import { validEntrySource } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import {
  buildDevelopmentBundle,
  captureBrowserErrors,
  delayHydration,
  expectCleanHydration,
} from "./react_shell_hydration_helpers.js";
import { expectFrameSource } from "./workspace_actions.js";

let fixture: Awaited<ReturnType<typeof createExportFixture>>;
let site: Awaited<ReturnType<typeof serveStaticFiles>>;
let developmentBundle: string;
test.beforeAll(async () => {
  developmentBundle = await buildDevelopmentBundle();
  fixture = await createExportFixture(
    validEntrySource({
      body: '<style>{":root { color-scheme: light; } @media (prefers-color-scheme: dark) { :root { color-scheme: dark; } }"}</style><input aria-label="Date" type="date" />',
    }),
  );
  await exportCatalogue(fixture.config, { outDir: "site" });
  site = await serveStaticFiles(fixture.output);
});
test.afterAll(async () => {
  await site.close();
  await fixture.close();
});

async function expectLightPreviews(page: Page): Promise<void> {
  for (const viewport of ["mobile", "desktop"]) {
    const frame = page.locator(`[data-workspace-frame="${viewport}"]`);
    await expectFrameSource(frame, new RegExp(`home\\.${viewport}\\.html$`));
    await expect(frame).toHaveCSS("color-scheme", "light");
    await expect(frame).toHaveCSS("background-color", "rgb(255, 255, 255)");
    const input = frame.contentFrame().getByLabel("Date");
    await expect(input).toHaveCSS("color-scheme", "light");
    expect(
      await frame.evaluate(
        (element: HTMLIFrameElement) =>
          element.contentWindow!.matchMedia("(prefers-color-scheme: dark)")
            .matches,
      ),
    ).toBe(false);
  }
  await expect(page.locator(".phone-screen")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator(".phone-status")).toHaveCSS(
    "color",
    "rgb(26, 29, 28)",
  );
  await expect(page.locator(".browser-viewport")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator(".mbk-frame-scheme-note")).toHaveCount(0);
}

for (const width of [390, 1280]) {
  test(`${width}: light-only previews keep their browser context before and after Dark hydration`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    // Let the iframe's color-scheme drive its media queries without an override.
    await page.emulateMedia({ colorScheme: null });
    const errors = captureBrowserErrors(page);
    const gate = await delayHydration(page, developmentBundle);
    const navigation = page.goto(
      `${site.url}/view/screens/home.html?scheme=dark`,
    );
    try {
      await gate.requested;
      await expectLightPreviews(page);
    } finally {
      gate.release();
      await navigation;
    }
    await expectCleanHydration(page, errors);
    for (const theme of ["dark", "light", "auto"]) {
      await page.locator("[data-mokly-appearance-select]").selectOption(theme);
      await expect(page.locator("html")).toHaveAttribute(
        "data-mokly-theme",
        theme,
      );
      await expectLightPreviews(page);
    }
  });
}
