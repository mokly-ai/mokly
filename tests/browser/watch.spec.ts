import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { expect, test, type Locator } from "@playwright/test";

import {
  createFixture,
  removeFixture,
  reparentedEntrySource,
  repositoryRoot,
  type TestFixture,
} from "../helpers/fixture.js";

import { chooseScheme, chooseViewport } from "./workspace_actions.js";
import { expectFrameSource } from "./workspace_actions.js";

const cli = path.join(repositoryRoot, "dist/cli/bin.js");

let fixture: TestFixture;
let child: ChildProcess;
let url: string;

async function toggleDisclosure(disclosure: Locator): Promise<void> {
  const toggled = disclosure.evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        element.addEventListener(
          "toggle",
          () => requestAnimationFrame(() => resolve()),
          { once: true },
        );
      }),
  );
  await disclosure.locator("summary").click();
  await toggled;
}

test.beforeAll(async () => {
  fixture = await createFixture(reparentedEntrySource("screens"), {
    extraConfig: `colorSchemes: ["light", "dark"],`,
  });
  child = spawn(
    "node",
    [cli, "serve", "--config", fixture.configPath, "--port", "0"],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  url = await new Promise<string>((resolve, reject) => {
    let buffered = "";
    const timer = setTimeout(
      () => reject(new Error(`serve did not start: ${buffered}`)),
      30_000,
    );
    child.stdout?.on("data", (chunk: Buffer) => {
      buffered += chunk.toString();
      const match = buffered.match(/Mokly listening at (http:\/\/[^\s]+)/);
      if (match?.[1]) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.on("exit", (code) =>
      reject(new Error(`serve exited early with ${code}: ${buffered}`)),
    );
  });
});

test.afterAll(async () => {
  if (child && child.exitCode === null) child.kill("SIGTERM");
  if (fixture) await removeFixture(fixture);
});

test("watched serve rebuilds and reloads after an authored change", async ({
  page,
}) => {
  let releaseFirstEventRequest = (): void => undefined;
  const firstEventRequestBlocked = new Promise<void>((resolve) => {
    releaseFirstEventRequest = resolve;
  });
  let blockFirstEventRequest = true;
  await page.route(`${url}/__mokly/events`, async (route) => {
    if (blockFirstEventRequest) {
      blockFirstEventRequest = false;
      await firstEventRequestBlocked;
    }
    await route.continue();
  });
  await page.goto(`${url}/view/screens/home.html`);
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
  const screens = page.locator(
    'details[data-nav-collection="collection:screens"]',
  );
  const archive = page.locator(
    'details[data-nav-collection="collection:archive"]',
  );
  await expect(screens).toHaveAttribute("open", "");
  await toggleDisclosure(screens);
  await expect(screens).not.toHaveAttribute("open", "");
  await expect(archive).not.toHaveAttribute("open", "");
  await page.fill("[data-mokly-search]", "html");
  await expect(screens).toHaveAttribute("open", "");
  await expect(archive).toHaveAttribute("open", "");
  await chooseViewport(page, "mobile");
  await chooseScheme(page, "dark");
  await expectFrameSource(
    page.locator(".mbk-frame-mobile iframe"),
    /screens\/home\.mobile\.dark\.html$/,
  );
  const details = page.locator("[data-workspace-inspector]");
  await expect(details).not.toHaveAttribute("data-open", "true");
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(details).toHaveAttribute("data-open", "true");
  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(details).not.toHaveAttribute("data-open", "true");
  await page.setViewportSize({ height: 900, width: 420 });
  await page.click("[data-mokly-menu]");
  await fs.promises.writeFile(
    fixture.entryPath,
    reparentedEntrySource("screens", {
      body: '<a href="mock:details">Details</a><p data-watch-version="2">Reloaded</p>',
    }),
  );
  await expect
    .poll(async () => {
      try {
        return (
          await (await fetch(`${url}/static/screens/home.mobile.html`)).text()
        ).includes('data-watch-version="2"');
      } catch {
        return false;
      }
    })
    .toBe(true);
  releaseFirstEventRequest();
  await expect(
    page
      .frameLocator(".mbk-frame-mobile iframe")
      .locator('[data-watch-version="2"]'),
  ).toHaveText("Reloaded", { timeout: 45_000 });
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
  await expect(page.locator("[data-mokly-search]")).toHaveValue("html");
  await expect(screens).toHaveAttribute("open", "");
  await expect(archive).toHaveAttribute("open", "");
  await expect(page.locator(".mbk-frame-mobile")).toBeVisible();
  await expect(page.locator(".mbk-frame-desktop")).toBeHidden();
  await expect(page.locator("body")).toHaveAttribute(
    "data-mokly-color-scheme",
    "dark",
  );
  await expectFrameSource(
    page.locator(".mbk-frame-mobile iframe"),
    /screens\/home\.mobile\.dark\.html$/,
  );
  await expect(page.locator("[data-workspace-scheme]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(details).not.toHaveAttribute("data-open", "true");
  await expect(page.locator("[data-mokly-shell]")).toHaveAttribute(
    "data-drawer",
    "open",
  );
  await page.fill("[data-mokly-search]", "");
  await expect(screens).toHaveAttribute("open", "");
  await expect(archive).not.toHaveAttribute("open", "");
});

test("watched reload reopens collapsed active route ancestry", async ({
  page,
}) => {
  await page.goto(`${url}/view/screens/home.html`);
  const screens = page.locator(
    'details[data-nav-collection="collection:screens"]',
  );
  await expect(screens).toHaveAttribute("open", "");
  await toggleDisclosure(screens);
  await expect(screens).not.toHaveAttribute("open", "");
  await page.fill("[data-mokly-search]", "html");
  await expect(screens).toHaveAttribute("open", "");
  await toggleDisclosure(screens);
  await expect(screens).not.toHaveAttribute("open", "");

  await fs.promises.writeFile(
    fixture.entryPath,
    reparentedEntrySource("screens", {
      body: '<a href="mock:details">Details</a><p data-watch-version="3">Active route</p>',
    }),
  );

  await expect(
    page
      .frameLocator(".mbk-frame-mobile iframe")
      .locator('[data-watch-version="3"]'),
  ).toHaveText("Active route", { timeout: 45_000 });
  await expect(page.locator("[data-mokly-search]")).toHaveValue("html");
  await expect(screens).toHaveAttribute("open", "");
  await page.fill("[data-mokly-search]", "");
  await expect(screens).toHaveAttribute("open", "");
});

test("watched reparenting moves navigation and crumbs together", async ({
  page,
}) => {
  await page.goto(`${url}/view/screens/home.html`);
  await expect(page.locator(".mbk-crumbs")).toHaveText("Fixture›Screens");
  const screens = page.locator(
    'details[data-nav-collection="collection:screens"]',
  );
  const archive = page.locator(
    'details[data-nav-collection="collection:archive"]',
  );
  await toggleDisclosure(screens);
  await expect(screens).not.toHaveAttribute("open", "");

  await fs.promises.writeFile(
    fixture.entryPath,
    reparentedEntrySource("archive", { firstTitle: "Home Reloaded" }),
  );

  await expect(page.locator(".mbk-crumbs")).toHaveText("Fixture›Archive", {
    timeout: 45_000,
  });
  await expect(
    archive.locator('a[data-route="screens/home.html"]'),
  ).toHaveAttribute("aria-current", "page");
  await expect(archive).toHaveAttribute("open", "");
  await expect(
    screens.locator('a[data-route="screens/home.html"]'),
  ).toHaveCount(0);
  await expect(screens).not.toHaveAttribute("open", "");
});

test("duplicate titles retain independent disclosure across reloads", async ({
  page,
}) => {
  await page.goto(`${url}/view/screens/home.html`);
  await fs.promises.writeFile(
    fixture.entryPath,
    reparentedEntrySource("archive", {
      archiveTitle: "Same title",
      firstTitle: "Home Reloaded",
      screensTitle: "Same title",
    }),
  );
  const screens = page.locator(
    'details[data-nav-collection="collection:screens"]',
  );
  const archive = page.locator(
    'details[data-nav-collection="collection:archive"]',
  );
  await expect(screens.locator("summary .mbk-nav-label")).toHaveText(
    "Same title",
    { timeout: 45_000 },
  );
  await expect(archive.locator("summary .mbk-nav-label")).toHaveText(
    "Same title",
  );

  await toggleDisclosure(screens);
  await expect(screens).toHaveAttribute("open", "");
  await toggleDisclosure(screens);
  await expect(screens).not.toHaveAttribute("open", "");
  await expect(archive).toHaveAttribute("open", "");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("mokly:nav-disclosure:v2")),
    )
    .toContain("collection:pages:screens");

  await page.reload();
  await expect(screens).not.toHaveAttribute("open", "");
  await expect(archive).toHaveAttribute("open", "");
});

test("watched serve shuts down cleanly", async () => {
  const exited = new Promise<number | null>((resolve) => {
    child.on("exit", (code) => resolve(code));
  });
  child.kill("SIGTERM");
  expect(await exited).toBe(0);
  await expect(async () => {
    await fetch(`${url}/`);
  }).rejects.toThrow();
});
