import { projectPathFor } from "../addresses";
import { installedAccount } from "../database-fixture";
import { expect, freshEmail, open, signIn, test } from "../harness";
import { appOrigin } from "../origins";
import { createProject } from "../project-setup";

import {
  openSettingsFromAccount,
  publishedViewerReady,
  publishedProject,
} from "./support";

test("one overlay is one entry, and the projects panel lists what the reader can open and creates the next", async ({
  page,
}) => {
  await signIn(page, freshEmail("one-entry"));
  const projectId = await createProject(page, "One Entry Org");
  const here = await projectPathFor(page, projectId);

  await test.step("one overlay is one entry, however the reader reached it", async () => {
    await open(page, here);

    // A panel opened from a panel replaces it, so closing lands on the page
    // rather than on the panel the reader came through.
    await page.getByTestId("viewer-history").click();
    await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
    await page.getByTestId("history-choose-publication").click();
    await expect(page.getByTestId("viewer-panel-switcher")).toBeVisible();
    await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
    await page.getByTestId("close-switcher").click();
    await expect(page.getByTestId("viewer-panel-switcher")).toHaveCount(0);
    await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
    await expect(page).toHaveURL((url) => url.pathname === here);

    // And the settings dialog obeys the same rule the panels do: one entry,
    // undone on close, so one press of Back leaves the page.
    await openSettingsFromAccount(page);
    await page.getByTestId("close-settings").click();
    await expect(page.getByTestId("settings-dialog")).toHaveCount(0);
    await expect(page).toHaveURL((url) => url.pathname === here);
    await page.goBack();
    await expect(page).not.toHaveURL((url) => url.pathname === here);
  });

  await test.step("the projects panel lists what the reader can open and creates the next", async () => {
    await open(page, here);
    await page.getByTestId("viewer-project").click();
    const panel = page.getByTestId("viewer-panel-projects");
    await expect(panel).toBeVisible();
    // The workspace is named with the GitHub accounts it connects, which the
    // installation list answers for every workspace at once.
    await expect(panel.locator(".fo-ref-head .fo-ref-detail")).toHaveText(
      installedAccount,
    );
    await expect(panel.getByText("Current")).toBeVisible();
    await expect(panel.getByText(new URL(appOrigin).host + here)).toBeVisible();
    await panel.getByTestId("projects-create").click();
    await expect(page).toHaveURL((url) =>
      /^\/[^/]+\/-\/new$/.test(url.pathname),
    );
  });
});

test("a trigger says which overlay it opens, and whether it is open", async ({
  page,
}) => {
  const made = await publishedProject(page, "announced");
  await open(page, made.publicationPath);
  await publishedViewerReady(page);

  // Every bar trigger opens one overlay or, for the avatar, its menu, and
  // says so before it is pressed.
  for (const [slot, popup] of [
    ["viewer-project", "dialog"],
    ["viewer-publication", "dialog"],
    ["viewer-history", "dialog"],
    ["viewer-share", "dialog"],
    ["viewer-account", "menu"],
  ] as const) {
    await expect(page.getByTestId(slot)).toHaveAttribute(
      "aria-haspopup",
      popup,
    );
    await expect(page.getByTestId(slot)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  }

  // Exactly the open one reports itself expanded, so a reader who cannot see
  // the overlay is still told. The avatar reports its menu, not the dialog
  // that the menu's items open.
  await page.getByTestId("viewer-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  await expect(page.getByTestId("viewer-history")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByTestId("viewer-share")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.getByTestId("close-history").click();
  await expect(page.getByTestId("viewer-panel-history")).toHaveCount(0);
  await openSettingsFromAccount(page);
  await expect(page.getByTestId("settings-dialog")).toBeVisible();
  await expect(page.getByTestId("viewer-account")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
