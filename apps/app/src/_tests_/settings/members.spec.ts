import { projectQueryPathFor } from "../addresses";
import { countRequests, failWith } from "../api-responses";
import {
  expect,
  freshEmail,
  currentWorkspaceId,
  openDialog,
  signIn,
  test,
} from "../harness";
import { addMember } from "../members";
import { createProject } from "../project-setup";
import { pressWrite } from "../writes";

import { manage, panelRole, panel } from "./pane-controls";

test("members invites an address and lists it as pending", async ({ page }) => {
  await signIn(page, freshEmail("members"));
  const projectId = await createProject(page, "Member Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=members"),
  );
  const invited = freshEmail("invited");
  await page.getByLabel("Email").fill(invited);
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText(invited)).toBeVisible();
  await expect(page.getByText("Invited", { exact: true })).toBeVisible();
});

test("a failed invitation revoke says so and offers one retry", async ({
  page,
}) => {
  await signIn(page, freshEmail("revoke-invite-fails"));
  const projectId = await createProject(page, "Inv Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=members"),
  );
  await expect(page.getByLabel("Email")).toBeVisible();
  await page.getByLabel("Email").fill(freshEmail("doomed-invite"));
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText("Invited", { exact: true })).toBeVisible();

  await failWith(
    page,
    "**/v1/workspaces/*/members/*",
    "DELETE",
    "version-conflict",
  );
  const revoke = page.getByRole("button", { name: "Revoke invitation" });
  await revoke.click();
  await expect(page.getByRole("alert")).toContainText("This changed elsewhere");
  await expect(
    page.getByRole("button", { name: "Try again" }).first(),
  ).toBeEnabled();
  // The invitation is still there, which is the honest thing to show.
  await expect(page.getByText("Invited", { exact: true })).toBeVisible();
});

test("a failed removal leaves no way back on the role form", async ({
  page,
}) => {
  await signIn(page, freshEmail("member-writes"));
  const projectId = await createProject(page, "Two Org");
  const workspaceId = await currentWorkspaceId(page);
  // A second real person, so the panel has a role form at all: an owner's role
  // is shown rather than offered, and a test that manages the owner asserts
  // nothing.
  const colleague = freshEmail("colleague");
  await addMember(page, workspaceId, colleague);
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=members"),
  );
  await manage(page, colleague);
  const role = page.getByTestId("save-role");
  await expect(role).toBeVisible();

  const roleWrites = await countRequests(
    page,
    "**/v1/workspaces/*/members/*",
    "PATCH",
  );
  await failWith(page, "**/v1/workspaces/*/members/*", "DELETE", "unavailable");
  await page.getByTestId("remove-member").click();
  await page.getByTestId("confirm-remove-member").click();
  await expect(page.getByRole("alert")).toContainText("Mokly is busy");
  await expect(page.getByTestId("confirm-remove-member")).toHaveText(
    "Try again",
  );
  // The reader changes their mind. The removal's failure goes with it, and the
  // role form is untouched by an operation it did not make.
  await page.getByRole("button", { name: "Keep access" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(role).toHaveText("Save role");
  await expect(role).toBeDisabled();
  expect(roleWrites()).toBe(0);
});

test("a failed role change stays on the role form", async ({ page }) => {
  await signIn(page, freshEmail("role-writes"));
  const projectId = await createProject(page, "Role Org");
  const workspaceId = await currentWorkspaceId(page);
  const colleague = freshEmail("colleague");
  await addMember(page, workspaceId, colleague);
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=members"),
  );
  await manage(page, colleague);

  await failWith(page, "**/v1/workspaces/*/members/*", "PATCH", "unavailable");
  await panelRole(page, "Admin").click();
  const role = page.getByTestId("save-role");
  await expect(role).toBeEnabled();
  await role.click();
  await expect(role).toHaveText("Try again");

  // The other control in the same panel is not the way back from this.
  await page.getByTestId("remove-member").click();
  const confirm = page.getByTestId("confirm-remove-member");
  await expect(confirm).toHaveText("Remove");
  await expect(
    page.getByTestId("remove-member-modal").getByRole("alert"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Keep access" }).click();

  // And putting the role back leaves no retry the control will not take, and
  // nothing of the failure it belonged to.
  await panelRole(page, "Reviewer").click();
  await expect(role).toHaveText("Save role");
  await expect(role).toBeDisabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".fo-error-details")).toHaveCount(0);
});

test("managing one member after another starts at rest", async ({ page }) => {
  await signIn(page, freshEmail("two-members"));
  const projectId = await createProject(page, "Panel Org");
  const workspaceId = await currentWorkspaceId(page);
  const first = freshEmail("first-colleague");
  // Neither has set a name, so their only name is their address.
  const second = "charlotte.wainwright@northwind.example";
  await addMember(page, workspaceId, first);
  await addMember(page, workspaceId, second, "admin");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=members"),
  );

  await manage(page, first);
  await panelRole(page, "Admin").click();
  await page.getByTestId("remove-member").click();
  await expect(page.getByTestId("confirm-remove-member")).toBeVisible();
  // The removal is asked over the pane, so declining it is the way back to
  // the list.
  await page.getByRole("button", { name: "Keep access" }).click();

  // The panel belongs to whoever is selected; the next one opens as its own.
  await manage(page, second);
  await expect(page.getByTestId("confirm-remove-member")).toHaveCount(0);
  await expect(panelRole(page, "Admin")).toBeChecked();
  await expect(page.getByTestId("save-role")).toBeDisabled();

  // Someone whose only name is an address is removed by a control that says
  // `Remove` alone: the heading above already carries the address, and no
  // label can hold one. It stays inside its column.
  await expect(page.getByTestId("remove-member")).toHaveText("Remove");
  await expect(panel(page)).toHaveAccessibleName("Manage " + second);
  const remove = await page.getByTestId("remove-member").boundingBox();
  const form = await panel(page).locator(".fo-form").boundingBox();
  expect(remove).not.toBeNull();
  expect(form).not.toBeNull();
  expect(
    (remove?.x ?? 0) + (remove?.width ?? 0),
    "the control's right edge is inside its form",
  ).toBeLessThanOrEqual((form?.x ?? 0) + (form?.width ?? 0) + 1);
});

test("a member who set a name is removed by a control that names them", async ({
  page,
}) => {
  await signIn(page, freshEmail("named-member"));
  const projectId = await createProject(page, "Named Org");
  // Naming is what makes a member's name something other than their address,
  // and the account pane is where the product does it.
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=account"),
  );
  await page.getByLabel("Name", { exact: true }).fill("Charlotte Wainwright");
  await pressWrite(
    page,
    page.getByTestId("save-account"),
    "PATCH",
    "/v1/account",
  );
  await expect(page.getByTestId("save-account")).toBeDisabled();

  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=members"),
  );
  await manage(page, "Charlotte Wainwright");
  await expect(page.getByTestId("remove-member")).toHaveText(
    "Remove Charlotte Wainwright",
  );
});
