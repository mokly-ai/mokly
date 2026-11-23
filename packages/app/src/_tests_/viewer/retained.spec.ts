import { expect, open, test } from "../harness";

import { retainedFixture } from "./retained-fixture";
import {
  canvasFrame,
  makePublic,
  openSettingsFromAccount,
  publishedViewerReady,
  publishedProject,
} from "./support";

test("a removed entry opens its advertised snapshot in Changes", async ({
  page,
}) => {
  const fixture = retainedFixture();
  try {
    const made = await publishedProject(page, "retained-entry", {
      branch: "main",
      fixture: fixture.path,
    });
    await makePublic(page, made.projectId);
    await open(page, made.publicationPath + "?view=changes");
    await publishedViewerReady(page);
    await page.getByRole("link", { name: /^Retired form/ }).click();
    await expect(page).toHaveURL(/catalogueScreen=product%2Fretired/);
    await expect(page).toHaveURL(/catalogueSnapshot=[a-f0-9]{64}/);
    await expect(
      page
        .frameLocator("iframe[srcdoc]")
        .getByRole("heading", { name: "Retired form" }),
    ).toBeVisible();
  } finally {
    fixture.dispose();
  }
});

test("Share copies a nested screen path that another browser can open", async ({
  page,
  context,
}) => {
  const fixture = retainedFixture();
  try {
    const made = await publishedProject(page, "nested-share", {
      branch: "main",
      fixture: fixture.path,
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
    expect(
      await settingsFrame?.evaluate((element) => element.isConnected),
    ).toBe(true);
  } finally {
    fixture.dispose();
  }
});
