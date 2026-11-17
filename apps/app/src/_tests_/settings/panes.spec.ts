import {
  countRequests,
  createProject,
  expect,
  failWith,
  freshEmail,
  currentWorkspaceId,
  openDialog,
  projectAddress,
  projectPathFor,
  projectQueryPathFor,
  signIn,
  test,
  unloadGuard,
} from "../harness";
import { makePrivate } from "../visibility";
import { apiOrigin } from "../origins";
import type { Page } from "@playwright/test";
import { addMember } from "../members";
import { chooseRevoke, makeToken } from "./tokens";
import { pressWrite } from "../writes";

/** Every pane opens, shows its own scope and acts against the real API. */

/** The manage panel, whoever it is for. */
function panel(page: Page) {
  return page.getByRole("region", { name: /^Manage / });
}

/**
 * Open the manage panel for one person, named by their address, and say whose
 * panel it is: a test that opens a detail panel asserts which one it opened,
 * rather than trusting the order a list happens to arrive in.
 */
async function manage(page: Page, who: string): Promise<void> {
  await page
    .locator(".fo-member-row")
    .filter({ hasText: who })
    .getByRole("button", { name: "Manage" })
    .click();
  await expect(panel(page)).toHaveAccessibleName("Manage " + who);
  await expect(page.getByTestId("remove-member")).toBeVisible();
}

/** The panel's own role control, which is not the invite form's. */
function panelRole(page: Page, name: string) {
  return panel(page).getByRole("radio", { name });
}

const panes = [
  ["account", "Account"],
  ["workspace", "Workspace"],
  ["github", "GitHub accounts"],
  ["members", "Members"],
  ["billing", "Billing"],
  ["project", "Project"],
  ["tokens", "Publishing tokens"],
  ["access", "Access"],
  ["danger", "Delete project"],
] as const;

test("every pane opens over the viewer and closes back to it", async ({
  page,
}) => {
  await signIn(page, freshEmail("panes"));
  const projectId = await createProject(page, "Pane Org");
  const viewer = await projectPathFor(page, projectId);
  for (const [pane, title] of panes) {
    await openDialog(page, `${viewer}?settings=${pane}`);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.locator("#root")).toHaveAttribute("aria-hidden", "true");
  }
  await openDialog(page, `${viewer}?settings=project`);
  await page.getByRole("link", { name: "Publishing tokens" }).click();
  await expect(page).toHaveURL(new RegExp("settings=tokens"));
  await page.getByTestId("close-settings").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the index shows every section, and an unknown pane opens the first", async ({
  page,
}) => {
  await signIn(page, freshEmail("index"));
  const projectId = await createProject(page, "Index Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings="),
  );
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { level: 1 })).toHaveText(
    "Settings",
  );
  await expect(dialog.getByRole("heading", { name: "You" })).toBeVisible();
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=nonsense"),
  );
  await expect(dialog.getByRole("heading", { level: 1 })).toHaveText("Account");
});

test("the account pane saves a name against the real API", async ({ page }) => {
  const email = freshEmail("name");
  await signIn(page, email);
  const projectId = await createProject(page, "Name Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=account"),
  );
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
  await page.getByLabel("Name", { exact: true }).fill("Cal Moore");
  const saved = page.waitForResponse(
    (answer) =>
      answer.url().endsWith("/v1/account") &&
      answer.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save changes" }).click();
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Cal Moore",
  );

  // The name is what the account frame's header now calls them, with the
  // address behind it one hover away rather than repeated on the page.
  await page.goto("/new");
  const identity = page.locator(".fo-account-header .review-account");
  await expect(identity.locator("span").last()).toHaveText("Cal Moore");
  await expect(identity).toHaveAttribute("title", email);
});

test("a token is created, revealed once and revoked behind a confirmation", async ({
  page,
}) => {
  await signIn(page, freshEmail("token"));
  const projectId = await createProject(page, "Token Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=tokens"),
  );
  await expect(page.getByText("Create a publishing token")).toBeVisible();
  await makeToken(page, "GitHub Actions");
  const secret = page.locator(".fo-secret");
  await expect(secret).toHaveText(/^mkc_[0-9a-f]{64}$/);
  // The one render of the secret is closed only by its own Done.
  await page.keyboard.press("Escape");
  await page.mouse.click(10, 10);
  await expect(secret).toBeVisible();
  await page.getByTestId("token-done").click();
  await expect(page.locator(".fo-secret")).toHaveCount(0);
  await expect(page.getByText("GitHub Actions", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator(".fo-secret")).toHaveCount(0);
  await chooseRevoke(page, "GitHub Actions");
  await expect(page.getByText("Create a replacement first.")).toBeVisible();
  await page.getByRole("button", { name: "Revoke token" }).click();
  await expect(page.getByText("Revoked")).toBeVisible();
  // A revoked token has nothing left to do.
  await expect(
    page.getByRole("button", { name: "Actions for GitHub Actions" }),
  ).toHaveCount(0);
});

test("deletion stays disabled until the project's own name is typed", async ({
  page,
}) => {
  await signIn(page, freshEmail("danger"));
  const projectId = await createProject(page, "Danger Org");
  const address = await projectAddress(page, projectId);
  // The project is named after the repository it was created for, so what the
  // confirmation asks for is read from the pane that holds it.
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=project"),
  );
  // The field waits in its frame while the settings scope loads.
  await expect(page.getByLabel("Project name")).toBeEditable();
  const name = await page.getByLabel("Project name").inputValue();
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=danger"),
  );
  const remove = page.getByRole("button", { name: "Delete project" });
  await expect(remove).toBeDisabled();
  await page.getByRole("textbox").fill("wrong");
  await expect(remove).toBeDisabled();
  await page.getByRole("textbox").fill(name);
  await expect(remove).toBeEnabled();
  await remove.click();
  await page.waitForURL(
    (url) => url.pathname === `/${address.workspaceSlug}/-/new`,
  );
});

test("access lists inherited workspace access", async ({ page }) => {
  const email = freshEmail("access");
  await signIn(page, email);
  const projectId = await createProject(page, "Access Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=access"),
  );
  await expect(page.getByText("From the workspace")).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();
});

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

test("a pane that cannot load keeps the dialog and offers one retry", async ({
  page,
}) => {
  await signIn(page, freshEmail("failure"));
  const projectId = await createProject(page, "Fail Org");
  await page.route("**/v1/projects/*/tokens", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "unavailable",
          reason: "unavailable",
          message: "Try again shortly.",
          request_id: "01994f10-0000-7000-8000-0000000000aa",
        },
      }),
    }),
  );
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=tokens"),
  );
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Tokens couldn’t load");
  await page.getByText("Details").click();
  await expect(
    page.getByText("01994f10-0000-7000-8000-0000000000aa"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("visibility changes behind a confirmation and offers the way back", async ({
  page,
}) => {
  await signIn(page, freshEmail("visibility"));
  const projectId = await createProject(page, "Vis Org");
  await makePrivate(page, projectId);
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=project"),
  );
  const change = page.getByTestId("change-visibility");
  const offered = await change.textContent();
  await change.click();
  await expect(page.getByTestId("confirm-visibility")).toBeVisible();

  await page.getByRole("button", { name: /^Keep (private|public)$/ }).click();
  await expect(page.getByTestId("confirm-visibility")).toHaveCount(0);
  await expect(change).toHaveText(offered ?? "");

  await change.click();
  await page.getByTestId("confirm-visibility").click();
  // The control now offers the way back, which is how the reader can see the
  // change took.
  await expect(change).not.toHaveText(offered ?? "");
});

test("changing visibility sends the visibility and not the name", async ({
  page,
}) => {
  await signIn(page, freshEmail("visibility-only"));
  const projectId = await createProject(page, "Only Org");
  await makePrivate(page, projectId);
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=project"),
  );
  // The field waits in its frame while the settings scope loads.
  await expect(page.getByLabel("Project name")).toBeEditable();
  const saved = await page.getByLabel("Project name").inputValue();

  await page.getByLabel("Project name").fill("Never pressed Save");
  await expect.poll(() => unloadGuard(page)).toBe(true);
  await page.getByTestId("change-visibility").click();
  await pressWrite(
    page,
    page.getByTestId("confirm-visibility"),
    "PATCH",
    `/v1/projects/${projectId}`,
  );
  await expect(page.getByTestId("change-visibility")).toBeVisible();

  // The server is the only witness worth asking: the name must be what it was.
  const stored = await page.evaluate(
    async ([id, origin]) => {
      const answer = await fetch(`${origin}/v1/projects/${id}`, {
        credentials: "include",
      });
      return (await answer.json()) as { name: string; visibility: string };
    },
    [projectId, apiOrigin] as const,
  );
  expect(stored.name).toBe(saved);
  expect(stored.visibility).toBe("public");
  // And the reader still has their draft, because they never saved it.
  await expect(page.getByLabel("Project name")).toHaveValue(
    "Never pressed Save",
  );
  await expect.poll(() => unloadGuard(page)).toBe(true);
});

test("an emptied name does not block a visibility change", async ({ page }) => {
  await signIn(page, freshEmail("visibility-empty"));
  const projectId = await createProject(page, "Empty Org");
  await makePrivate(page, projectId);
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=project"),
  );
  await page.getByLabel("Project name").fill("");
  await page.getByTestId("change-visibility").click();
  await page.getByTestId("confirm-visibility").click();
  // The confirmation closes, which is how the reader sees the change took.
  await expect(page.getByTestId("confirm-visibility")).toHaveCount(0);
  await expect(page.getByTestId("change-visibility")).toHaveText(
    "Make private",
  );
});

test("a failed token revoke says so and offers one retry", async ({ page }) => {
  await signIn(page, freshEmail("revoke-token-fails"));
  const projectId = await createProject(page, "Rev Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=tokens"),
  );
  await makeToken(page, "Doomed token");
  await page.getByTestId("token-done").click();

  await failWith(page, "**/v1/projects/*/tokens/*", "DELETE", "unavailable");
  await chooseRevoke(page, "Doomed token");
  const confirm = page.getByTestId("confirm-revoke");
  await confirm.click();
  await expect(page.getByRole("alert")).toContainText("Mokly is busy");
  await expect(confirm).toHaveText("Try again");
  await expect(confirm).toBeEnabled();
  await page.getByText("Details").last().click();
  await expect(page.getByText("Reference")).toBeVisible();
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

test("a token is reported copied only when it was", async ({ page }) => {
  await signIn(page, freshEmail("clipboard"));
  const projectId = await createProject(page, "Clip Org");
  // A browser that will not copy: a page served over plain http, an older
  // permission path, a reader who has refused. The secret is on screen, so
  // saying it was copied when it was not is the one unrecoverable answer.
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=tokens"),
  );
  await makeToken(page, "Uncopyable token");
  const copy = page.getByTestId("copy-token");
  const secret = await page.locator(".fo-secret").textContent();

  await copy.click();
  await expect(copy).toHaveText("Copy token");
  await expect(page.getByRole("alert")).toContainText("Copying didn’t work");
  await expect(page.locator(".fo-secret")).toHaveText(secret ?? "");
});

test("a clipboard that refuses is not reported as a copy", async ({ page }) => {
  await signIn(page, freshEmail("clipboard-refuses"));
  const projectId = await createProject(page, "Deny Org");
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
  });
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=tokens"),
  );
  await makeToken(page, "Refused token");
  const copy = page.getByTestId("copy-token");
  await copy.click();
  await expect(copy).toHaveText("Copy token");
  await expect(page.getByRole("alert")).toContainText("Copying didn’t work");
});

test("pressing a destructive control twice sends one write", async ({
  page,
}) => {
  await signIn(page, freshEmail("one-write"));
  const projectId = await createProject(page, "Once Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=tokens"),
  );
  await makeToken(page, "Twice pressed");
  await page.getByTestId("token-done").click();

  const sent = await countRequests(page, "**/v1/projects/*/tokens/*", "DELETE");
  await chooseRevoke(page, "Twice pressed");
  const confirm = page.getByTestId("confirm-revoke");
  // Two presses in one task, before anything can be disabled in between: the
  // control has to refuse the second itself, not rely on being greyed out.
  // While its write works it is busy, which refuses a press and keeps focus.
  await confirm.evaluate((node: HTMLElement) => {
    node.click();
    node.click();
  });
  await expect(confirm).toHaveAttribute("aria-busy", "true");
  await expect(page.getByText("Revoked")).toBeVisible();
  expect(sent()).toBe(1);
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
