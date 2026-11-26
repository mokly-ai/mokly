import { expect, open, test as base } from "../harness";

import { retainedFixture } from "./retained-fixture";
import {
  canvasFrame,
  makePublic,
  openSettingsFromAccount,
  publishedViewerReady,
  publishedProject,
} from "./support";

/**
 * One retained-evidence export for every test of this file. Each test only
 * reads the archive and publishes it into a project of its own, so the CLI
 * builds it once for the worker, at the first test that asks for it.
 */
const test = base.extend<object, { retained: () => string }>({
  retained: [
    // Playwright requires the fixture argument to be a destructuring pattern,
    // even when nothing is used.
    // eslint-disable-next-line no-empty-pattern
    async ({}, provide) => {
      let built: ReturnType<typeof retainedFixture> | undefined;
      try {
        await provide(() => (built ??= retainedFixture()).path);
      } finally {
        built?.dispose();
      }
    },
    { scope: "worker" },
  ],
});

test("a removed entry opens its advertised snapshot in Changes", async ({
  page,
  retained,
}) => {
  const made = await publishedProject(page, "retained-entry", {
    branch: "main",
    fixture: retained(),
  });
  await makePublic(page, made.projectId);
  await open(page, made.publicationPath + "?view=changes");
  await publishedViewerReady(page);
  await page.getByRole("link", { name: /^Retired form/ }).click();
  await expect(page).toHaveURL(/catalogueScreen=product%2Fretired/);
  await expect(page).toHaveURL(/catalogueSnapshot=[a-f0-9]{64}/);
  // The link from Changes opens one viewport, and its frame shows the
  // removed screen's previous version.
  await expect(
    canvasFrame(page, "Retired form")
      .contentFrame()
      .getByRole("heading", { name: "Retired form" }),
  ).toBeVisible();
});

test("Share copies a nested screen path that another browser can open", async ({
  page,
  context,
  retained,
}) => {
  const made = await publishedProject(page, "nested-share", {
    branch: "main",
    fixture: retained(),
  });
  await makePublic(page, made.projectId);
  await open(
    page,
    made.publicationPath + "?catalogueScreen=product%2FStart_here-2",
  );
  await publishedViewerReady(page);
  const frame = await canvasFrame(
    page,
    "Current form — desktop",
  ).elementHandle();
  expect(frame).not.toBeNull();
  await page.getByTestId("viewer-share").click();
  const link = page.getByLabel("Publication link");
  await expect(link).toHaveValue(/catalogueScreen=product%2FStart_here-2/);
  expect(await frame?.evaluate((element) => element.isConnected)).toBe(true);
  const url = await link.inputValue();
  expect(new URL(url).searchParams.get("catalogueScreen")).toBe(
    "product/Start_here-2",
  );
  const recipient = await context.newPage();
  await recipient.goto(url);
  await publishedViewerReady(recipient);
  await expect(
    recipient.getByRole("heading", { level: 2, name: "Current form" }),
  ).toBeVisible();
  await expect(
    canvasFrame(recipient, "Current form — desktop")
      .contentFrame()
      .getByRole("heading", { name: "Published form" }),
  ).toBeVisible();
  await recipient.close();

  await page.getByTestId("close-share").click();
  await expect(page.getByTestId("viewer-panel-share")).toHaveCount(0);
  await publishedViewerReady(page);
  const settingsFrame = await canvasFrame(
    page,
    "Current form — desktop",
  ).elementHandle();
  expect(settingsFrame).not.toBeNull();
  await openSettingsFromAccount(page);
  const settings = page.getByTestId("settings-dialog");
  await expect(settings).toBeVisible();
  await expect(
    settings.getByRole("heading", {
      level: 1,
      name: "Settings",
      exact: true,
    }),
  ).toBeVisible();
  expect(await settingsFrame?.evaluate((element) => element.isConnected)).toBe(
    true,
  );
});
