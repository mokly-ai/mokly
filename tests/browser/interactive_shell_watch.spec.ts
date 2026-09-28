import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  createFixture,
  removeFixture,
  repositoryRoot,
  type TestFixture,
} from "../helpers/fixture.js";
import { waitForInitialChanges } from "../helpers/watched_catalogue.js";

import { interactiveShellSource } from "./interactive_shell_fixture.js";
import {
  expectLive,
  expectLiveReady,
  liveFrame,
  previewMode,
} from "./interactive_shell_helpers.js";

const cli = path.join(repositoryRoot, "dist/cli/bin.js");

let fixture: TestFixture;
let child: ChildProcess;
let url: string;

test.beforeAll(async () => {
  fixture = await createFixture(interactiveShellSource(true), {
    extraConfig: 'interactive: "serve",',
  });
  child = spawn(
    "node",
    [cli, "serve", "--config", fixture.configPath, "--port", "0"],
    { stdio: ["ignore", "pipe", "pipe"] },
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
      if (match?.[1] && buffered.includes("Mokly Live at ")) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.on("exit", (code) =>
      reject(new Error(`serve exited early with ${code}: ${buffered}`)),
    );
  });
  await waitForInitialChanges(url, 60_000);
});

test.afterAll(async () => {
  if (child && child.exitCode === null) {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    await exited;
  }
  if (fixture) await removeFixture(fixture);
});

test("a watched rebuild reloads the Live frame on the new generation", async ({
  page,
}) => {
  await page.goto(`${url}/view/screens/home.html`);
  await expect(page.locator("html")).toHaveAttribute("data-mokly-react-shell");
  await previewMode(page).getByRole("button", { name: "Live" }).click();
  await expectLiveReady(page);
  const count = liveFrame(page, "desktop").locator("#count");
  await expect(count).toHaveText("Home: 0");
  const bundle = () =>
    liveFrame(page, "desktop")
      .locator('script[type="module"]')
      .getAttribute("src");
  const before = await bundle();
  expect(before).toMatch(/^\/__mokly\/interactive\/[a-f0-9]{32}\/bundle\.js$/);

  await fs.promises.writeFile(
    fixture.entryPath,
    interactiveShellSource(true).replaceAll('label="Home"', 'label="Rebuilt"'),
  );
  await expect(count).toHaveText("Rebuilt: 0", { timeout: 60_000 });
  await expectLive(page);
  await expectLiveReady(page);
  expect(await bundle()).not.toBe(before);
  await page.reload();
  await expect(
    previewMode(page).getByRole("button", { name: "Static" }),
  ).toHaveAttribute("aria-pressed", "true");
});
