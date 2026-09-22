import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { exportCatalogue } from "../../dist/export/run.js";
import { createExampleBaseline } from "../helpers/example_baseline.js";
import { repositoryRoot } from "../helpers/fixture.js";
import {
  timeExportPreparation,
  timeFixturePhase,
} from "../helpers/fixture_timing.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { assertServedShellMarker } from "./export_shell.js";
import { REAL_EXPORT_FIXTURE_TIMEOUT_MS } from "./fixture_timeouts.js";
import { chooseViewport } from "./workspace_actions.js";

let output: string;
let root: string;
let server: Awaited<ReturnType<typeof serveStaticFiles>>;
test.beforeAll(async () => {
  test.setTimeout(REAL_EXPORT_FIXTURE_TIMEOUT_MS);
  root = await fs.promises.mkdtemp(
    path.join(repositoryRoot, ".context/mokly-example-export-"),
  );
  const config = await timeFixturePhase(
    "static-example",
    "baseline-fixture",
    false,
    () => createExampleBaseline(root),
  );
  output = path.join(root, "site");
  await timeExportPreparation("static-example", () =>
    exportCatalogue(config, { base: "HEAD", outDir: output }),
  );
  server = await serveStaticFiles(output);
  await assertServedShellMarker(server.url, "/view/screens/welcome.html");
});
test.afterAll(async () => {
  await server?.close();
  if (root) await fs.promises.rm(root, { recursive: true, force: true });
});

test("the owning example stays usable when HEAD is the unchanged baseline", async ({
  page,
}, info) => {
  const failures: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${server.url}/id/example-welcome/?fragment=welcome`);
    await expect(page).toHaveURL(
      `${server.url}/view/screens/welcome.html?fragment=welcome`,
    );
    await chooseViewport(page, width === 390 ? "mobile" : "desktop");
    await expect(page.locator("[data-workspace-status]")).toHaveText(
      "Unmodified",
    );
    await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
    const frames = page.locator("[data-current-screen] iframe");
    for (const frame of await frames.all()) {
      await expect(frame.contentFrame().locator("h1")).toHaveText(
        "Welcome to Mokly",
      );
      await frame
        .contentFrame()
        .locator("body")
        .evaluate(async () => {
          await document.fonts.ready;
        });
    }
    await page.screenshot({ path: info.outputPath(`${width}-Current.png`) });
  }
  expect(failures).toEqual([]);
  expect(server.requests.some((url) => url.includes("/__mokly/events"))).toBe(
    false,
  );
});

test("the exported example discloses a screen's variants without a server", async ({
  page,
}) => {
  const list = page.locator(
    '[data-nav-disclosure="variants:pages:example-welcome"]',
  );
  const toggle = page.locator("[data-nav-variants-toggle]");
  const variantRow = page.locator(
    'a[data-nav-row][data-route="screens/welcome.variants/empty.html"]',
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${server.url}/view/screens/details.html`);
  await expect(list).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await expect(list).toBeVisible();
  await expect(variantRow).toBeVisible();

  await variantRow.click();
  await expect(page).toHaveURL(
    `${server.url}/view/screens/welcome.variants/empty.html`,
  );
  await expect(page.locator("#mb-main h2")).toHaveText(
    "Welcome, empty workspace",
  );
  await expect(variantRow).toHaveAttribute("aria-current", "page");
  await expect(page.getByLabel("Catalogue location").locator("a")).toHaveText(
    "Welcome",
  );
});
