import fs from "node:fs";
import path from "node:path";

import { expect, type Page } from "@playwright/test";

import { parseManifest } from "../../dist/registry/manifest.js";

import {
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
export const fixtureRoutes = [
  ...new Set(
    manifest.entries.flatMap((entry) =>
      entry.kind === "collection" ? [] : [entry.route],
    ),
  ),
];
expect(fixtureRoutes.length).toBeGreaterThan(80);

/** Route inventory is partitioned by its stable generated-manifest order. */
export function routesForPartition(partition: number): string[] {
  return fixtureRoutes.filter((_, index) => index % 4 === partition);
}

export async function hydrateFixtureRoute(
  page: Page,
  bundle: string,
  route: string,
): Promise<void> {
  const errors = captureBrowserErrors(page);
  await installDevelopmentBundle(page, bundle);
  const encoded = route.split("/").map(encodeURIComponent).join("/");
  const response = await page.goto(`/view/${encoded}`);
  expect(response?.status(), route).toBe(200);
  await expectCleanHydration(page, errors, route);
}

export async function hydrateShellRoute(
  page: Page,
  bundle: string,
  route: string,
): Promise<void> {
  const errors = captureBrowserErrors(page);
  await installDevelopmentBundle(page, bundle);
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
}
