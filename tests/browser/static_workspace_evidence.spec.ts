import fs from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { exportCatalogue } from "../../dist/export/run.js";
import { componentEntrySource } from "../helpers/component_fixture.js";
import { createExportFixture } from "../helpers/export_fixture.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

let fixture: Awaited<ReturnType<typeof createExportFixture>>;
let server: Awaited<ReturnType<typeof serveStaticFiles>>;
let site: string;
let actionPage: string;
const retainedDocumentAttribute = "data-static-evidence-document";

test.beforeAll(async () => {
  test.setTimeout(90_000);
  const source = componentEntrySource();
  fixture = await createExportFixture(source);
  await fs.writeFile(
    fixture.entryPath,
    source.replace(
      "<button data-viewport=",
      '<button className="changed" data-viewport=',
    ),
  );
  await exportCatalogue(fixture.config, { outDir: "site" });
  site = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/static-workspace-evidence-"),
  );
  await fs.cp(fixture.output, site, { recursive: true });
  actionPage = await fs.readFile(
    path.join(site, "view/components/action.html"),
    "utf8",
  );
  server = await serveStaticFiles(site);
});

test.afterAll(async () => {
  await server?.close();
  await fixture?.close();
  if (site) await fs.rm(site, { force: true, recursive: true });
});

test("static navigation retains the destination's route-specific evidence", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/components/action.html`);
  await expectHydratedDocument(page);
  await expectAffectedHome(page);

  await page.goto(`${server.url}/view/screens/home.html`);
  await retainHydratedDocument(page);
  await page.locator('a[data-route="components/action.html"]').click();
  await expect(page).toHaveURL(`${server.url}/view/components/action.html`);
  await expectRetainedDocument(page);
  await expectAffectedHome(page);
});

test("static route evidence cannot cross a rapid Back and Forward replacement", async ({
  page,
}) => {
  let reads = 0;
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let finishFirst = (): void => undefined;
  const firstFinished = new Promise<void>((resolve) => {
    finishFirst = resolve;
  });
  await page.route("**/view/components/action.html", async (route) => {
    reads++;
    if (reads === 1) await gate;
    try {
      await route.continue();
    } catch {
      // Back aborts the first route-evidence read before it can be adopted.
    } finally {
      if (reads === 1) finishFirst();
    }
  });

  await page.goto(`${server.url}/view/screens/home.html`);
  await retainHydratedDocument(page);
  await page.locator('a[data-route="components/action.html"]').click();
  await expect(page).toHaveURL(`${server.url}/view/components/action.html`);
  await expectRetainedDocument(page);
  await expect.poll(() => reads).toBe(1);

  const back = page.goBack();
  await expect(page).toHaveURL(`${server.url}/view/screens/home.html`);
  await expectRetainedDocument(page);
  release();
  await Promise.all([back, firstFinished]);
  await expectRelatedAction(page);

  await page.goForward();
  await expect(page).toHaveURL(`${server.url}/view/components/action.html`);
  await expectRetainedDocument(page);
  await expectAffectedHome(page);
  expect(reads).toBe(2);
});

for (const [boundary, corrupt] of [
  ["deployment", corruptDeployment],
  ["catalogue", corruptCatalogue],
  ["content revision", corruptContentVersion],
] as const)
  test(`static route evidence rejects a different ${boundary} identity`, async ({
    page,
  }) => {
    let served = (): void => undefined;
    const responseServed = new Promise<void>((resolve) => {
      served = resolve;
    });
    await page.route("**/view/components/action.html", async (route) => {
      await route.fulfill({
        body: corrupt(actionPage),
        contentType: "text/html",
      });
      served();
    });

    await page.goto(`${server.url}/view/screens/home.html`);
    await retainHydratedDocument(page);
    await page.locator('a[data-route="components/action.html"]').click();
    await expect(page).toHaveURL(`${server.url}/view/components/action.html`);
    await expectRetainedDocument(page);
    await responseServed;
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );

    const workspace = await page
      .locator("script[data-workspace-data]")
      .textContent();
    expect(workspace).not.toBeNull();
    expect(JSON.parse(workspace!).affected).toEqual([]);
    await page.getByRole("tab", { name: "Usage", exact: true }).click();
    await expect(page.locator('[data-usage-section="affected"]')).toHaveCount(
      0,
    );
  });

async function expectHydratedDocument(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-mokly-hydrated", "");
}

async function retainHydratedDocument(page: Page) {
  await expectHydratedDocument(page);
  await page
    .locator("html")
    .evaluate(
      (root, attribute) => root.setAttribute(attribute, "retained"),
      retainedDocumentAttribute,
    );
}

async function expectRetainedDocument(page: Page) {
  await expectHydratedDocument(page);
  await expect(page.locator("html")).toHaveAttribute(
    retainedDocumentAttribute,
    "retained",
  );
}

async function expectAffectedHome(page: Page) {
  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  const usage = page.getByRole("tabpanel", { name: "Usage", exact: true });
  await expect(usage).toContainText("Affected screens and components");
  await expect(usage.getByRole("link", { name: "Home" }).first()).toBeVisible();
}

async function expectRelatedAction(page: Page) {
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  const details = page.getByRole("tabpanel", {
    name: "Details",
    exact: true,
  });
  await expect(details).toContainText("Changed component: Action");
}

function corruptDeployment(html: string): string {
  const match = html.match(
    /&quot;deploymentId&quot;:&quot;([a-f0-9]{64})&quot;/,
  );
  if (!match?.[1]) throw new Error("Missing finalized deployment identity");
  return html.replace(match[1], replacementIdentity(match[1]));
}

function corruptCatalogue(html: string): string {
  const match = html.match(
    /"catalogue":\{"identity":"([a-f0-9]{64})","kind":"external"/,
  );
  if (!match?.[1]) throw new Error("Missing catalogue identity");
  return html.replace(match[1], replacementIdentity(match[1]));
}

function corruptContentVersion(html: string): string {
  const existing = /"contentVersion":\d+/;
  if (existing.test(html))
    return html.replace(existing, '"contentVersion":999');
  const marker = '"context":{';
  if (!html.includes(marker)) throw new Error("Missing bootstrap context");
  return html.replace(marker, `${marker}"contentVersion":999,`);
}

function replacementIdentity(value: string): string {
  return value === "f".repeat(64) ? "e".repeat(64) : "f".repeat(64);
}
