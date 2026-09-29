import fs from "node:fs";
import path from "node:path";

import { expect, type Page } from "@playwright/test";

import { parseManifest } from "../../dist/registry/manifest.js";

import {
  captureBrowserErrors,
  expectCleanHydration,
  installDevelopmentBundle,
} from "./react_shell_hydration_helpers.js";

const ROUTE_FILES = 4;

/** Return every fourth unique catalogue route, starting at this file's part. */
export function hydrationFixtureRoutes(part: number): string[] {
  if (!Number.isInteger(part) || part < 1 || part > ROUTE_FILES)
    throw new Error(`hydration route part must be 1 to ${ROUTE_FILES}`);
  const manifest = parseManifest(
    JSON.parse(
      fs.readFileSync(
        path.resolve("examples/basic/generated/mokly-manifest.json"),
        "utf8",
      ),
    ),
  );
  const routes = [
    ...new Set(
      manifest.entries.flatMap((entry) =>
        entry.kind === "collection" ? [] : [entry.route],
      ),
    ),
  ];
  expect(routes.length).toBeGreaterThan(80);
  return routes.filter((_, index) => index % ROUTE_FILES === part - 1);
}

export async function expectFixtureRouteHydrates(
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
