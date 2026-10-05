import { test } from "@playwright/test";

import { buildDevelopmentBundle } from "./react_shell_hydration_helpers.js";
import {
  hydrateFixtureRoute,
  hydrateShellRoute,
  routesForPartition,
} from "./react_shell_hydration_route_inventory.js";

let developmentBundle: string;
test.beforeAll(async () => {
  test.setTimeout(120_000);
  developmentBundle = await buildDevelopmentBundle();
});

for (const route of routesForPartition(0)) {
  test(`development React hydrates fixture route ${route}`, async ({
    page,
  }) => {
    await hydrateFixtureRoute(page, developmentBundle, route);
  });
}

for (const route of ["/", "/view/not-in-catalogue.html"]) {
  test(`development React hydrates shell route ${route}`, async ({ page }) => {
    await hydrateShellRoute(page, developmentBundle, route);
  });
}
