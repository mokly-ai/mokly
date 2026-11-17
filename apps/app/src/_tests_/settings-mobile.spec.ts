import type { Page } from "@playwright/test";

import {
  workspaceSettingsPathFor,
  projectQueryPathFor,
  projectSettingsPathFor,
} from "./addresses";
import {
  currentWorkspaceId,
  expect,
  freshEmail,
  leaveDocument,
  open,
  signIn,
  test,
  unloadGuard,
} from "./harness";
import { addMember } from "./members";
import { createProject } from "./project-setup";

test("the compact index lists every section as a full-screen layer", async ({
  page,
}) => {
  await signIn(page, freshEmail("mobile-index"));
  const projectId = await createProject(page, "Mobile Org");
  await open(page, "/settings");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" }),
  ).toBeVisible();
  await expect(page.getByText("Publishing tokens")).toBeVisible();
  await open(page, await projectSettingsPathFor(page, projectId, "project"));
  await expect(
    page.getByRole("heading", { level: 1, name: "Project" }),
  ).toBeVisible();
  await expect(page.locator("main")).toHaveCount(1);
});

test("each project pane has its own compact route", async ({ page }) => {
  await signIn(page, freshEmail("mobile-panes"));
  const projectId = await createProject(page, "Panes Org");
  for (const [pane, title] of [
    ["tokens", "Publishing tokens"],
    ["access", "Access"],
    ["danger", "Delete project"],
  ] as const) {
    await open(page, await projectSettingsPathFor(page, projectId, pane));
    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  }
});

test("the account route is its own layer and returns to the index", async ({
  page,
}) => {
  await signIn(page, freshEmail("mobile-account"));
  await page.waitForURL((url) => url.pathname === "/new");
  await open(page, "/settings/account");
  await expect(
    page.getByRole("heading", { level: 1, name: "Account" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Settings" }).click();
  await page.waitForURL((url) => url.pathname === "/settings");
});

test("compact actions clear the 44px touch target", async ({ page }) => {
  await signIn(page, freshEmail("mobile-target"));
  await page.waitForURL((url) => url.pathname === "/new");
  await open(page, "/settings/account");
  // While the settings scope loads, its wait draws a Save changes of its own,
  // which the loaded pane replaces; a box read across that answer reads
  // nothing. So the box is read once the pane takes input.
  await expect(page.getByRole("textbox", { name: "Name" })).toBeEditable();
  const box = await page
    .getByRole("button", { name: "Save changes" })
    .boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test("a compact pane keeps its loading and error states in the layer", async ({
  page,
}) => {
  await signIn(page, freshEmail("mobile-state"));
  const projectId = await createProject(page, "State Org");
  await page.route("**/v1/projects/*/members", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "unavailable",
          reason: "unavailable",
          message: "Try again shortly.",
          request_id: "01994f10-0000-7000-8000-0000000000bb",
        },
      }),
    }),
  );
  await open(page, await projectSettingsPathFor(page, projectId, "access"));
  await expect(page.getByRole("alert")).toContainText("Access couldn’t load");
  await expect(
    page.getByRole("heading", { level: 1, name: "Access" }),
  ).toBeVisible();
});

test("removing an address-only member fits the narrowest layer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await signIn(page, freshEmail("mobile-remove"));
  await createProject(page, "Remove Org");
  const workspaceId = await currentWorkspaceId(page);
  // Someone who has never set a name, so their only name is this address.
  const colleague = "jordan.mccallister@northwind.example";
  await addMember(page, workspaceId, colleague);
  await open(
    page,
    await workspaceSettingsPathFor(page, workspaceId, "members"),
  );
  await page
    .locator(".fo-member-row")
    .filter({ hasText: colleague })
    .getByRole("button", { name: "Manage" })
    .click();

  const remove = page.getByTestId("remove-member");
  await expect(remove).toHaveText("Remove");
  const box = await remove.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "nothing runs past the narrowest layer").toBeLessThanOrEqual(
    1,
  );
});

test("a query-addressed pane lands on its durable compact route", async ({
  page,
}) => {
  await signIn(page, freshEmail("mobile-query"));
  const projectId = await createProject(page, "Query Org");
  const durable = await projectSettingsPathFor(page, projectId, "tokens");
  await page.goto(
    await projectQueryPathFor(page, projectId, "settings=tokens"),
  );
  await page.waitForURL((url) => url.pathname === durable);
  await expect(
    page.getByRole("heading", { level: 1, name: "Publishing tokens" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the compact index reaches the project panes", async ({ page }) => {
  await signIn(page, freshEmail("mobile-project-index"));
  await createProject(page, "Index Org");
  await open(page, "/settings");
  await expect(page.getByRole("heading", { name: "Project" })).toBeVisible();
  const tokens = page.getByRole("link", { name: "Open" }).nth(4);
  await expect(tokens).toBeVisible();
  await page.getByText("Tokens that publish this project").click();
  await expect(page.getByText("Publishing tokens").first()).toBeVisible();
});

test("the compact back link confirms before discarding a draft", async ({
  page,
}) => {
  await signIn(page, freshEmail("mobile-dirty"));
  const projectId = await createProject(page, "Dirty Org");
  await open(page, await projectSettingsPathFor(page, projectId, "project"));
  await page.getByLabel("Project name").fill("Compact draft");
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByText("Discard your changes?")).toBeVisible();
  await page.getByTestId("keep-changes").click();
  await expect(page.getByLabel("Project name")).toHaveValue("Compact draft");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByTestId("discard-changes").click();
  await page.waitForURL((url) => url.pathname === "/settings");
});

test("the pane names the document while it is open", async ({ page }) => {
  await signIn(page, freshEmail("mobile-title"));
  const projectId = await createProject(page, "Title Org");
  await open(page, await projectSettingsPathFor(page, projectId, "tokens"));
  await expect(page).toHaveTitle("Publishing tokens · Mokly");
});

/** The reader's own way into a pane: a step inside the running application. */
async function openPane(page: Page, pane: string): Promise<void> {
  await page
    .locator(".content-list-row")
    // Exact, because one pane's title can sit inside another's: Account and
    // GitHub accounts.
    .filter({ has: page.getByText(pane, { exact: true }) })
    .getByRole("link")
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: pane, exact: true }),
  ).toBeVisible();
}

test("a pane reached in-app leaves in one press, clean or discarded", async ({
  page,
}) => {
  await signIn(page, freshEmail("mobile-push"));
  await createProject(page, "Push Org");
  await open(page, "/settings");
  const depth = await page.evaluate(() => window.history.length);
  await openPane(page, "Publishing tokens");
  expect(await page.evaluate(() => window.history.length)).toBe(depth + 1);

  await page.goBack();
  await page.waitForURL((url) => url.pathname === "/settings");
  expect(await page.evaluate(() => window.history.length)).toBe(depth + 1);

  await openPane(page, "Account");
  await page.getByLabel("Name", { exact: true }).fill("Pushed draft");
  await page.goBack();
  await expect(page.getByText("Discard your changes?")).toBeVisible();
  await expect(page).toHaveURL(/settings\/account$/);
  await page.getByTestId("keep-changes").click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Pushed draft",
  );

  await page.goBack();
  await page.getByTestId("discard-changes").click();
  // The gesture lands where the browser was already going, which is the same
  // place the on-screen back affordance goes.
  await page.waitForURL((url) => url.pathname === "/settings");
  expect(await page.evaluate(() => window.history.length)).toBe(depth + 1);
});

test("the compact back gesture confirms before discarding a draft", async ({
  page,
}) => {
  await signIn(page, freshEmail("mobile-back"));
  const projectId = await createProject(page, "Back Org");
  // A deep link opens the pane as the first document in its own history, so
  // back leaves the document and only the browser can hold it.
  await open(page, await projectSettingsPathFor(page, projectId, "project"));
  expect(await unloadGuard(page)).toBe(false);
  const name = page.getByLabel("Project name");
  // The field waits in its frame while the settings scope loads.
  await expect(name).toBeEditable();
  const saved = await name.inputValue();
  await name.fill("Gesture draft");
  await expect.poll(() => unloadGuard(page)).toBe(true);

  const prompts = await leaveDocument(page, () =>
    page.goBack({ timeout: 5_000 }),
  );
  expect(prompts).toContain("beforeunload");
  await expect(name).toHaveValue("Gesture draft");

  await name.fill(saved);
  await expect.poll(() => unloadGuard(page)).toBe(false);
});
