import fs from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { exportCatalogue } from "../../dist/export/run.js";
import { createExportFixture } from "../helpers/export_fixture.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { assertServedShellMarker } from "./export_shell.js";

let fixture: Awaited<ReturnType<typeof createExportFixture>>;
let server: Awaited<ReturnType<typeof serveStaticFiles>>;
let isolated: string;

test.beforeAll(async () => {
  test.setTimeout(60_000);
  fixture = await createExportFixture();
  isolated = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/static-deployment-"),
  );
  const before = await exportCatalogue(fixture.config, {
    outDir: "site",
  });
  await fs.cp(fixture.output, isolated, { recursive: true });
  const after = await exportCatalogue(fixture.config, {
    outDir: "site",
    adapter: {
      transform: (files) => {
        files.set(
          "__mokly/shell.css",
          `${files.get("__mokly/shell.css")}\n/* New deployment */\n`,
        );
      },
    },
  });
  expect(after.comparisonUrl).toBe(before.comparisonUrl);
  expect(after.deploymentId).not.toBe(before.deploymentId);
  server = await serveStaticFiles(isolated);
  await assertServedShellMarker(server.url, "/view/screens/home.html");
});

test.afterAll(async () => {
  await server?.close();
  await fixture?.close();
  if (isolated) await fs.rm(isolated, { recursive: true, force: true });
});

test("an old tab reloads for a new deployment even when comparisons did not change", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/screens/home.html`);
  await page
    .locator("html")
    .evaluate((root) => root.setAttribute("data-test-old-tab", "retained"));
  await page.locator('a[data-route="screens/details.html"]').click();
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
  await expect(page.locator("html")).toHaveAttribute(
    "data-test-old-tab",
    "retained",
  );
  await fs.cp(fixture.output, isolated, { recursive: true });
  await page.locator('a[data-route="screens/home.html"]').click();
  await expect(page).toHaveURL(`${server.url}/view/screens/home.html`);
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-test-old-tab",
    "retained",
  );
});
