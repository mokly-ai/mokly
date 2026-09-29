import { expect, test } from "@playwright/test";

import {
  buildDevelopmentBundle,
  captureBrowserErrors,
  expectCleanHydration,
  installDevelopmentBundle,
} from "./react_shell_hydration_helpers.js";
import {
  expectFixtureRouteHydrates,
  hydrationFixtureRoutes,
} from "./react_shell_hydration_route_helpers.js";

let developmentBundle: string;
test.beforeAll(async () => {
  test.setTimeout(120_000);
  developmentBundle = await buildDevelopmentBundle();
});

for (const route of hydrationFixtureRoutes(1)) {
  test(`development React hydrates fixture route ${route}`, async ({
    page,
  }) => {
    await expectFixtureRouteHydrates(page, developmentBundle, route);
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
