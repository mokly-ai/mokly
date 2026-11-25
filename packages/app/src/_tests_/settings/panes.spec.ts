import { projectPathFor, projectQueryPathFor } from "../addresses";
import { expect, freshEmail, openDialog, signIn, test } from "../harness";
import { createProject } from "../project-setup";

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
