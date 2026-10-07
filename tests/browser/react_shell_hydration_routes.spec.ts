import fs from "node:fs";
import path from "node:path";

import { expect, test as base } from "@playwright/test";

import { parseManifest } from "../../dist/registry/manifest.js";
import { hydrationShapeSample } from "../helpers/hydration_shapes.js";

import {
  buildDevelopmentBundle,
  captureBrowserErrors,
  expectCleanHydration,
  installDevelopmentBundle,
} from "./react_shell_hydration_helpers.js";

interface DevelopmentBundleWorkerFixtures {
  readonly developmentBundle: string;
}

/** Route tests share one development bundle per worker, not one per test. */
const test = base.extend<Record<never, never>, DevelopmentBundleWorkerFixtures>(
  {
    developmentBundle: [
      async ({ browserName: _browserName }, use) => {
        await use(await buildDevelopmentBundle());
      },
      { scope: "worker", timeout: 120_000 },
    ],
  },
);

test.describe.configure({ mode: "parallel" });

const manifest = parseManifest(
  JSON.parse(
    fs.readFileSync(
      path.resolve("examples/basic/mokly-generated/mokly-manifest.json"),
      "utf8",
    ),
  ),
);
expect(manifest.entries.length).toBeGreaterThan(80);
const sample = hydrationShapeSample(manifest.entries);
expect(sample.length).toBeGreaterThan(0);

for (const { route, shape } of sample) {
  test(`development React hydrates fixture route ${route}`, async ({
    developmentBundle,
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await installDevelopmentBundle(page, developmentBundle);
    const encoded = route.split("/").map(encodeURIComponent).join("/");
    const response = await page.goto(`/view/${encoded}`);
    expect(response?.status(), route).toBe(200);
    await expectCleanHydration(page, errors, `${route} (${shape})`);
  });
}

for (const [route, expectedStatus] of [
  ["/", 200],
  ["/view/not-in-catalogue.html", 200],
] as const) {
  test(`development React hydrates shell route ${route}`, async ({
    developmentBundle,
    page,
  }) => {
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
    expect(response?.status(), route).toBe(expectedStatus);
    await expectCleanHydration(page, errors, route);
  });
}
