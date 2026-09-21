import fs from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { exportCatalogue } from "../../dist/export/run.js";
import { componentEntrySource } from "../helpers/component_fixture.js";
import { createExportFixture } from "../helpers/export_fixture.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { assertServedShellMarker } from "./export_shell.js";

let fixture: Awaited<ReturnType<typeof createExportFixture>>;
let server: Awaited<ReturnType<typeof serveStaticFiles>>;
let installed: string;
let oldExport: string;
let mountedCatalogue: string;
const fragment = "react-native-stylesheet";

test.beforeAll(async () => {
  test.setTimeout(90_000);
  fixture = await createExportFixture(componentEntrySource());
  installed = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/static-state-installed-"),
  );
  oldExport = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/static-state-old-"),
  );
  await exportCatalogue(fixture.config, { outDir: "site" });
  await fs.cp(fixture.output, installed, { recursive: true });
  await fs.cp(fixture.output, oldExport, { recursive: true });
  mountedCatalogue = await fs.readFile(
    path.join(oldExport, "__mokly/catalogue.json"),
    "utf8",
  );
  await exportCatalogue(fixture.config, {
    outDir: "site",
    adapter: {
      transform: (files) => {
        files.set(
          "__mokly/shell.css",
          `${files.get("__mokly/shell.css")}\n/* replacement */\n`,
        );
      },
    },
  });
  server = await serveStaticFiles(installed);
  await assertServedShellMarker(server.url, "/view/components/action.html");
});

test.afterAll(async () => {
  await server?.close();
  await fixture?.close();
  await Promise.all(
    [installed, oldExport]
      .filter(Boolean)
      .map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

test.beforeEach(async () => {
  await fs.cp(oldExport, installed, { recursive: true });
});

test("a static direct URL restores its variant and fragment after refresh", async ({
  page,
}) => {
  const url = `${server.url}/view/components/action.html?variant=disabled&fragment=${fragment}`;
  await page.goto(url);
  await expectStaticComponentQuery(page, "disabled");

  await page.reload();
  await expectStaticComponentQuery(page, "disabled");
});

test("a static alias retains its initial fragment through normalization and refresh", async ({
  page,
}) => {
  await page.goto(`${server.url}/id/action/?fragment=${fragment}`);
  await expect(page).toHaveURL(
    `${server.url}/view/components/action.html?fragment=${fragment}`,
  );
  await expectStaticComponentQuery(page, "default");

  await page.reload();
  await expectStaticComponentQuery(page, "default");
});

for (const failure of ["missing", "different deployment"] as const)
  test(`a ${failure} shared catalogue leaves the server-rendered document usable`, async ({
    page,
  }) => {
    let requests = 0;
    const stale = JSON.parse(mountedCatalogue) as Record<string, unknown>;
    stale["deploymentId"] = replacementIdentity(String(stale["deploymentId"]));
    await page.route("**/__mokly/catalogue.json", async (route) => {
      requests++;
      if (failure === "missing") await route.abort();
      else await route.fulfill({ json: stale });
    });

    await page.goto(`${server.url}/view/screens/home.html`);
    await expect.poll(() => requests).toBe(1);
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-mokly-hydrated",
      "",
    );
    const action = page.locator('a[data-route="components/action.html"]');
    await expect(action).toHaveAttribute(
      "href",
      "/view/components/action.html",
    );
    await page
      .locator("html")
      .evaluate((root) => root.setAttribute("data-original-page", "true"));

    await action.click();

    await expect(page).toHaveURL(`${server.url}/view/components/action.html`);
    await expect(page.locator("#mb-main h2")).toHaveText("Action");
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-original-page",
      "true",
    );
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-mokly-hydrated",
      "",
    );
    expect(requests).toBe(2);
  });

test("an explicit hydration retry can recover after the shared catalogue returns", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/__mokly/catalogue.json", async (route) => {
    requests++;
    if (requests === 1) await route.abort();
    else await route.continue();
  });
  await page.goto(`${server.url}/view/screens/home.html`);
  await expect.poll(() => requests).toBe(1);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-mokly-hydrated",
    "",
  );

  await page.evaluate(async () => {
    const modulePath = "/__mokly/client/react-shell.js";
    const browser = (await import(modulePath)) as {
      hydrateMoklyShell(doc?: Document): void;
    };
    browser.hydrateMoklyShell(document);
  });

  await expect(page.locator("html")).toHaveAttribute("data-mokly-hydrated", "");
  expect(requests).toBe(2);
});

test("Back validates the static deployment before installing history", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/screens/home.html`);
  await page.locator('a[data-route="components/action.html"]').click();
  await expect(page.locator("#mb-main h2")).toHaveText("Action");
  await page
    .locator("html")
    .evaluate((root) => root.setAttribute("data-old-deployment", "true"));

  await fs.cp(fixture.output, installed, { recursive: true });
  await page.goBack();

  await expect(page.locator("#mb-main h2")).toHaveText("Home");
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-old-deployment",
    "true",
  );
});

test("Forward validates the static deployment before installing history", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/screens/home.html`);
  await page.locator('a[data-route="components/action.html"]').click();
  await expect(page.locator("#mb-main h2")).toHaveText("Action");
  await page.goBack();
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
  await page
    .locator("html")
    .evaluate((root) => root.setAttribute("data-old-deployment", "true"));

  await fs.cp(fixture.output, installed, { recursive: true });
  await page.goForward();

  await expect(page.locator("#mb-main h2")).toHaveText("Action");
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-old-deployment",
    "true",
  );
});

test("a newer history action cancels superseded deployment validation", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/screens/home.html`);
  await page.locator('a[data-route="components/action.html"]').click();
  await expect(page.locator("#mb-main h2")).toHaveText("Action");
  await page
    .locator("html")
    .evaluate((root) => root.setAttribute("data-history-owner", "current"));

  const stale = JSON.parse(mountedCatalogue) as Record<string, unknown>;
  stale["deploymentId"] = "f".repeat(64);
  let releaseFirst = (): void => undefined;
  const firstReleased = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let finishFirst = (): void => undefined;
  const firstFinished = new Promise<void>((resolve) => {
    finishFirst = resolve;
  });
  let validations = 0;
  await page.route("**/__mokly/catalogue.json", async (route) => {
    validations++;
    if (validations === 1) {
      await firstReleased;
      try {
        await route.fulfill({ json: stale });
      } catch {
        // The newer transition is expected to abort this request.
      } finally {
        finishFirst();
      }
      return;
    }
    await route.fulfill({
      body: mountedCatalogue,
      contentType: "application/json",
    });
  });

  const back = page.goBack();
  await expect.poll(() => validations, { timeout: 5_000 }).toBe(1);
  const forward = page.goForward();
  await expect.poll(() => validations).toBe(2);
  releaseFirst();
  await firstFinished;
  await Promise.all([back, forward]);

  await expect(page).toHaveURL(`${server.url}/view/components/action.html`);
  await expect(page.locator("#mb-main h2")).toHaveText("Action");
  await expect(page.locator("html")).toHaveAttribute(
    "data-history-owner",
    "current",
  );
});

async function expectStaticComponentQuery(
  page: Page,
  variant: string,
): Promise<void> {
  await expect(page.getByLabel("Saved variant", { exact: true })).toHaveValue(
    variant,
  );
  for (const viewport of ["mobile", "desktop"])
    await expect(
      page.locator(`iframe[data-workspace-frame="${viewport}"]`),
    ).toHaveAttribute(
      "src",
      new RegExp(
        `action\\.variants/${variant}\\.${viewport}\\.html#${fragment}$`,
      ),
    );
}

function replacementIdentity(value: string): string {
  return value === "f".repeat(64) ? "e".repeat(64) : "f".repeat(64);
}
