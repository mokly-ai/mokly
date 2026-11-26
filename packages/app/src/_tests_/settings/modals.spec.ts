import type { Page } from "@playwright/test";

import { projectQueryPathFor } from "../addresses";
import {
  currentWorkspaceId,
  expect,
  freshEmail,
  openDialog,
  signIn,
  test,
} from "../harness";
import { addMember } from "../members";
import { createProject } from "../project-setup";

import { holdsWhileSending, holdWrite } from "./held-writes";
import { chooseRevoke, makeToken, rowMenu } from "./tokens";

/**
 * A row's three-dot menu and the questions a pane asks over itself, on a
 * pointer surface: the menu is a popover anchored to its trigger, and each
 * question is a modal over the settings dialog, which stays open beneath it.
 */

async function tokensPane(page: Page, label: string): Promise<void> {
  await signIn(page, freshEmail(label));
  const projectId = await createProject(page, `${label} Org`);
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=tokens"),
  );
}

/** The settings dialog, found by its own name rather than as the top layer. */
function settings(page: Page) {
  return page.getByTestId("settings-dialog");
}

test("a row's menu opens anchored to its trigger and closes with Escape", async ({
  page,
}) => {
  await tokensPane(page, "row-menu");
  await makeToken(page, "Deploys");
  await page.getByTestId("token-done").click();

  const trigger = rowMenu(page, "Deploys");
  await expect(trigger).toHaveAttribute("aria-haspopup", "menu");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const menu = page.getByRole("menu", { name: "Actions for Deploys" });
  await expect(menu).toBeVisible();
  await expect(
    menu.getByRole("menuitem", { name: "Revoke", exact: true }),
  ).toBeVisible();

  // Below the trigger, with its end edge on the trigger's.
  const anchor = (await trigger.boundingBox())!;
  const surface = (await menu.boundingBox())!;
  expect(surface.y).toBeGreaterThanOrEqual(anchor.y + anchor.height);
  expect(surface.x + surface.width).toBeLessThanOrEqual(
    anchor.x + anchor.width + 8,
  );

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(settings(page)).toBeVisible();
  await expect(trigger).toBeFocused();
});

test("a confirmation declined with Escape leaves settings open", async ({
  page,
}) => {
  await tokensPane(page, "decline");
  await makeToken(page, "Keep me");
  await page.getByTestId("token-done").click();

  await chooseRevoke(page, "Keep me");
  const question = page.getByRole("dialog", { name: "Revoke Keep me?" });
  await expect(question).toBeVisible();
  // The pane beneath is inert while the question is open.
  await expect(rowMenu(page, "Keep me")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(question).toHaveCount(0);
  await expect(settings(page)).toBeVisible();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  await expect(rowMenu(page, "Keep me")).toBeFocused();
});

test("the keyboard moves between a confirmation's two decisions", async ({
  page,
}) => {
  await tokensPane(page, "tab-order");
  await makeToken(page, "Tabbed");
  await page.getByTestId("token-done").click();

  await chooseRevoke(page, "Tabbed");
  const confirm = page.getByTestId("confirm-revoke");
  const keep = page.getByRole("button", { name: "Keep token" });
  await confirm.focus();
  await page.keyboard.press("Tab");
  await expect(keep).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Revoked")).toBeVisible();
});

test("a token revoke holds while its write is in flight", async ({ page }) => {
  await tokensPane(page, "in-flight");
  await makeToken(page, "Slow");
  await page.getByTestId("token-done").click();

  const release = await holdWrite(page, "**/v1/projects/*/tokens/*", "DELETE");
  await chooseRevoke(page, "Slow");
  await page.getByTestId("confirm-revoke").click();
  await expect(page.getByTestId("confirm-revoke")).toHaveText("Revoking…");
  await holdsWhileSending(page, "Revoke Slow?");

  release();
  await expect(page.getByRole("dialog", { name: "Revoke Slow?" })).toHaveCount(
    0,
  );
  await expect(page.getByText("Revoked")).toBeVisible();
});

test("a member removal holds while its write is in flight", async ({
  page,
}) => {
  await signIn(page, freshEmail("remove-flight"));
  const projectId = await createProject(page, "Flight Org");
  const colleague = freshEmail("flight-colleague");
  await addMember(page, await currentWorkspaceId(page), colleague);
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=members"),
  );
  await page
    .locator(".fo-member-row")
    .filter({ hasText: colleague })
    .getByRole("button", { name: "Manage" })
    .click();

  const release = await holdWrite(
    page,
    "**/v1/workspaces/*/members/*",
    "DELETE",
  );
  await page.getByTestId("remove-member").click();
  await page.getByTestId("confirm-remove-member").click();
  await expect(page.getByTestId("confirm-remove-member")).toHaveText(
    "Removing…",
  );
  await holdsWhileSending(page, "Remove " + colleague + "?");

  release();
  await expect(page.getByTestId("confirm-remove-member")).toHaveCount(0);
  await expect(page.getByText(colleague)).toHaveCount(0);
});

test("declining the create modal discards the name it held", async ({
  page,
}) => {
  await tokensPane(page, "abandon");
  await page.getByTestId("new-token").click();
  await page.getByLabel("Token name").fill("Abandoned");
  await page.getByTestId("cancel-token").click();
  await expect(page.getByLabel("Token name")).toHaveCount(0);
  await expect(settings(page)).toBeVisible();

  await page.getByTestId("new-token").click();
  await expect(page.getByLabel("Token name")).toHaveValue("");
  await page.getByLabel("Token name").fill("Escaped");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Token name")).toHaveCount(0);
  // Nothing the modal held is a draft the dialog would ask about.
  await page.getByTestId("close-settings").click();
  await expect(settings(page)).toHaveCount(0);
});
