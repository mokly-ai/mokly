import {
  createProject,
  expect,
  freshEmail,
  leaveDocument,
  open,
  openDialog,
  projectPathFor,
  projectQueryPathFor,
  signIn,
  test,
  unloadGuard,
} from "../harness";

import { openDialogInApp } from "./in-app";

/** The browser's own back and forward, and what the history stack costs. */

test("opening the dialog costs one history entry and one press leaves", async ({
  page,
}) => {
  await signIn(page, freshEmail("back-count"));
  const projectId = await createProject(page, "Count Org");
  const viewer = await projectPathFor(page, projectId);
  await open(page, viewer);
  const before = await page.evaluate(() => window.history.length);
  await openDialog(page, `${viewer}?settings=account`);
  expect(await page.evaluate(() => window.history.length)).toBe(before + 1);
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL((url) => url.pathname === viewer);
});

test("closing the dialog does not leave it behind the back gesture", async ({
  page,
}) => {
  await signIn(page, freshEmail("back-close"));
  const projectId = await createProject(page, "Shut Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=account"),
  );
  await page.getByTestId("close-settings").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

// The reader's own way into the dialog is a step inside the running
// application, not a page load, and only that path exercises the router's
// history. A narrow window widened is the one such path that exists before the
// viewer's chrome carries a settings control.

test("the back gesture over a draft asks, and discarding completes it", async ({
  page,
}) => {
  await signIn(page, freshEmail("back-finish"));
  await createProject(page, "Finish Org");
  await openDialogInApp(page, "Account");
  const depth = await page.evaluate(() => window.history.length);
  await page.getByLabel("Name", { exact: true }).fill("Gesture Draft");

  await page.goBack();
  await expect(page.getByText("Discard your changes?")).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(new RegExp("settings=account"));
  expect(await page.evaluate(() => window.history.length)).toBe(depth);
  await page.getByTestId("keep-changes").click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Gesture Draft",
  );

  await page.goBack();
  await page.getByTestId("discard-changes").click();
  // The gesture finishes where the browser was already going: the step the
  // reader took into the pane is undone, and nothing else.
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 1 }),
  ).toHaveText("Settings");
  expect(await page.evaluate(() => window.history.length)).toBe(depth);
});

test("the browser's back gesture confirms before discarding a draft", async ({
  page,
}) => {
  await signIn(page, freshEmail("back-dirty"));
  const projectId = await createProject(page, "Back Org");
  // A bookmark, a shared link or a typed address loads the surface as the
  // first document in its own history, so back leaves the document and only
  // the browser can hold it.
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=account"),
  );
  expect(await unloadGuard(page)).toBe(false);
  await page.getByLabel("Name", { exact: true }).fill("Back Draft");
  await expect.poll(() => unloadGuard(page)).toBe(true);

  const prompts = await leaveDocument(page, () =>
    page.goBack({ timeout: 5_000 }),
  );
  expect(prompts).toContain("beforeunload");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Back Draft",
  );

  await page.getByLabel("Name", { exact: true }).fill("");
  await expect.poll(() => unloadGuard(page)).toBe(false);
});

test("a reloaded surface still holds a draft against the browser", async ({
  page,
}) => {
  await signIn(page, freshEmail("back-reload"));
  const projectId = await createProject(page, "Reload Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=account"),
  );
  await page.reload();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("Reloaded Draft");
  await expect.poll(() => unloadGuard(page)).toBe(true);
  const prompts = await leaveDocument(page, () =>
    page.goBack({ timeout: 5_000 }),
  );
  expect(prompts).toContain("beforeunload");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Reloaded Draft",
  );
});

test("pressing back twice keeps the address and the screen together", async ({
  page,
}) => {
  await signIn(page, freshEmail("back-rapid"));
  await createProject(page, "Rapid Org");
  await openDialogInApp(page, "Account");
  const home = page.url();
  const depth = await page.evaluate(() => window.history.length);
  await page.getByLabel("Name", { exact: true }).fill("Rapid Draft");

  await page.evaluate(() => {
    window.history.back();
    window.history.back();
  });
  await expect(page.getByText("Discard your changes?")).toBeVisible();
  await expect(page).toHaveURL(home);
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 1 }),
  ).toHaveText("Account");
  expect(await page.evaluate(() => window.history.length)).toBe(depth);

  await page.getByTestId("keep-changes").click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Rapid Draft",
  );
  await page.goBack();
  await page.getByTestId("discard-changes").click();
  // One press, one step: the index the reader came from, not the page before it.
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 1 }),
  ).toHaveText("Settings");
});

test("a second draft after an exit is defended like the first", async ({
  page,
}) => {
  await signIn(page, freshEmail("rearm"));
  await createProject(page, "Rearm Org");
  await openDialogInApp(page, "Account");

  await page.getByLabel("Name", { exact: true }).fill("First draft");
  await page.goBack();
  await expect(page.getByText("Discard your changes?")).toBeVisible();
  await page.getByTestId("discard-changes").click();
  // The gesture completes: the reader is back on the index they came from,
  // which on this wide surface is the dialog's own.
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 1 }),
  ).toHaveText("Settings");

  // The same surface again, without touching the viewport: the guard has to
  // be back in place for a reader's second visit, not only their first.
  await openDialogInApp(page, "Account");
  await page.getByLabel("Name", { exact: true }).fill("Second draft");
  await page.goBack();
  await expect(page.getByText("Discard your changes?")).toBeVisible();
  await page.getByTestId("keep-changes").click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Second draft",
  );
});

test("every way to another pane leaves the dialog one press deep", async ({
  page,
}) => {
  await signIn(page, freshEmail("pane-depth"));
  const projectId = await createProject(page, "Depth Org");
  const viewer = await projectPathFor(page, projectId);
  await open(page, viewer);
  const beneath = await page.evaluate(() => window.history.length);

  // The dialog is one entry over the page beneath, and the three ways to
  // another pane — the index's rows, the rail, and a pane's own link — all
  // stay inside that one entry.
  await openDialog(page, `${viewer}?settings=`);
  const open1 = await page.evaluate(() => window.history.length);
  expect(open1).toBe(beneath + 1);

  await page
    .locator(".content-list-row")
    .filter({ hasText: "Publishing tokens" })
    .getByRole("link")
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Publishing tokens" }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.history.length)).toBe(open1);

  await page.getByRole("link", { name: "Access" }).click();
  await expect(
    page.getByRole("button", { name: "Manage members" }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.history.length)).toBe(open1);

  await page.getByRole("button", { name: "Manage members" }).click();
  await expect(page.getByLabel("Email")).toBeVisible();
  expect(await page.evaluate(() => window.history.length)).toBe(open1);

  // And one press of Back still closes settings.
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL((url) => url.pathname === viewer);
});
