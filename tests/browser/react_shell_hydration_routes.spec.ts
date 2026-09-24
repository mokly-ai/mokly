import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { parseManifest } from "../../dist/registry/manifest.js";

import {
  buildDevelopmentBundle,
  captureBrowserErrors,
  expectCleanHydration,
  installDevelopmentBundle,
} from "./react_shell_hydration_helpers.js";

const manifest = parseManifest(
  JSON.parse(
    fs.readFileSync(
      path.resolve("examples/basic/generated/mokly-manifest.json"),
      "utf8",
    ),
  ),
);
const fixtureRoutes = [
  ...new Set(manifest.entries.map((entry) => entry.route)),
];
expect(fixtureRoutes.length).toBeGreaterThan(80);

let developmentBundle: string;
test.beforeAll(async () => {
  test.setTimeout(120_000);
  developmentBundle = await buildDevelopmentBundle();
});

for (const route of fixtureRoutes) {
  test(`development React hydrates fixture route ${route}`, async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await installDevelopmentBundle(page, developmentBundle);
    const encoded = route.split("/").map(encodeURIComponent).join("/");
    const response = await page.goto(`/view/${encoded}`);
    expect(response?.status(), route).toBe(200);
    await expectCleanHydration(page, errors, route);
  });
}

for (const route of [
  "/",
  "/view/not-in-catalogue.html",
  "/id/example-welcome",
]) {
  test(`development React hydrates shell route ${route}`, async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await installDevelopmentBundle(page, developmentBundle);
    if (route === "/view/not-in-catalogue.html") {
      await page.route("**/view/not-in-catalogue.html", async (request) => {
        const response = await request.fetch();
        expect(response.status()).toBe(404);
        await request.fulfill({ response, status: 200 });
      });
    }
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expectCleanHydration(page, errors, route);
  });
}
