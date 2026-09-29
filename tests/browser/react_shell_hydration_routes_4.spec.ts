import { test } from "@playwright/test";

import { buildDevelopmentBundle } from "./react_shell_hydration_helpers.js";
import {
  expectFixtureRouteHydrates,
  hydrationFixtureRoutes,
} from "./react_shell_hydration_route_helpers.js";

let developmentBundle: string;
test.beforeAll(async () => {
  test.setTimeout(120_000);
  developmentBundle = await buildDevelopmentBundle();
});

for (const route of hydrationFixtureRoutes(4)) {
  test(`development React hydrates fixture route ${route}`, async ({
    page,
  }) => {
    await expectFixtureRouteHydrates(page, developmentBundle, route);
  });
}
