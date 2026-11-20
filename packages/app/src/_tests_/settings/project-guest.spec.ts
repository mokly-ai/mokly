import { projectAddress } from "../addresses";
import { expect, freshEmail, openDialog, signIn, test } from "../harness";
import { currentUserId, grantProject } from "../members";
import { createProject } from "../project-setup";
import { captureReadableAddress } from "../readable-addresses-support";

test("a project-only guest sees project settings without workspace panes", async ({
  page,
}) => {
  await signIn(page, freshEmail("project-guest-owner"));
  const projectId = await createProject(page, "Private Workspace");
  const address = await projectAddress(page, projectId);
  const owner = await page.context().storageState();

  await page.context().clearCookies();
  await signIn(page, freshEmail("project-only-guest"));
  const guestId = await currentUserId(page);
  const guest = await page.context().storageState();

  await page.context().clearCookies();
  await page.context().addCookies(owner.cookies);
  await grantProject(page, projectId, guestId);
  await page.context().clearCookies();
  await page.context().addCookies(guest.cookies);

  await openDialog(page, `${address.path}?settings=project`);
  const rail = page.getByRole("navigation", { name: "Settings sections" });
  await expect(
    rail.getByRole("link", { name: "Project", exact: true }),
  ).toBeVisible();
  await expect(
    rail.getByRole("link", { name: "Publishing tokens" }),
  ).toHaveAttribute("href", `${address.path}?settings=tokens`);
  await expect(rail.getByRole("link", { name: "Workspace" })).toHaveCount(0);
  await expect(rail.getByRole("link", { name: "Members" })).toHaveCount(0);
  await captureReadableAddress(page, "desktop-project-only-settings");
});
