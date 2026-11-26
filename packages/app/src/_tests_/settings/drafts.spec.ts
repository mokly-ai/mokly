import {
  projectPathFor,
  projectQueryPathFor,
  projectSettingsPathFor,
} from "../addresses";
import {
  expect,
  freshEmail,
  leaveDocument,
  open,
  openDialog,
  signIn,
  test,
  unloadGuard,
} from "../harness";
import { createProject } from "../project-setup";

/** What the reader has typed, and what it takes to lose it. */

test("Escape on a dirty pane confirms before discarding the draft", async ({
  page,
}) => {
  await signIn(page, freshEmail("escape-dirty"));
  const projectId = await createProject(page, "Dirty Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=account"),
  );
  await page.getByLabel("Name", { exact: true }).fill("Dirty Draft");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Discard your changes?")).toBeVisible();
  await page.getByTestId("keep-changes").click();
  await expect(page.getByText("Discard your changes?")).toHaveCount(0);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Dirty Draft",
  );
  await page.keyboard.press("Escape");
  await page.getByTestId("discard-changes").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Escape still confirms when the processor is throttled", async ({
  page,
}) => {
  await signIn(page, freshEmail("escape-slow"));
  const projectId = await createProject(page, "Slow Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=account"),
  );
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 20 });
  await page.getByLabel("Name", { exact: true }).fill("Throttled Draft");
  await page.keyboard.press("Escape");
  await expect(page.getByText("Discard your changes?")).toBeVisible();
  await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await page.getByTestId("keep-changes").click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Throttled Draft",
  );
});

test("the backdrop confirms before discarding a draft too", async ({
  page,
}) => {
  await signIn(page, freshEmail("backdrop-dirty"));
  const projectId = await createProject(page, "Back Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=project"),
  );
  await page.getByLabel("Project name").fill("Draft name");
  await page.mouse.click(20, 20);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Discard your changes?")).toBeVisible();
  await page.getByTestId("keep-changes").click();
  await expect(page.getByLabel("Project name")).toHaveValue("Draft name");
});

test("switching panes keeps what the reader typed in the other", async ({
  page,
}) => {
  await signIn(page, freshEmail("pane-draft"));
  const projectId = await createProject(page, "Keep Org");
  const accountPath = await projectQueryPathFor(
    page,
    projectId,
    "settings=account",
  );
  await openDialog(page, accountPath);
  await page.getByLabel("Name", { exact: true }).fill("Kept across panes");
  await page.getByRole("link", { name: "Project", exact: true }).click();
  await expect(page.getByLabel("Project name")).toBeVisible();
  await page.getByLabel("Project name").fill("Kept name");
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Kept across panes",
  );
  await page.getByRole("link", { name: "Project", exact: true }).click();
  await expect(page.getByLabel("Project name")).toHaveValue("Kept name");
  // Leaving settings is what forgets them, and the question says so: both
  // panes are lost, not only the one on screen.
  await page.getByTestId("close-settings").click();
  await expect(
    page.getByText("Your unsaved changes in settings are lost."),
  ).toBeVisible();
  await page.getByTestId("discard-changes").click();
  await openDialog(page, accountPath);
  await expect(page.getByLabel("Name", { exact: true })).not.toHaveValue(
    "Kept across panes",
  );
  await page.getByRole("link", { name: "Project", exact: true }).click();
  await expect(page.getByLabel("Project name")).not.toHaveValue("Kept name");
});

test("a draft survives the surface changing under it", async ({ page }) => {
  await signIn(page, freshEmail("rotate"));
  const projectId = await createProject(page, "Rotate Org");
  const query = "handoff=one%26two+literal%2Bplus%23notes&tag=first&tag=second";
  await page.setViewportSize({ width: 390, height: 844 });
  await open(
    page,
    `${await projectSettingsPathFor(page, projectId, "project")}?${query}`,
  );
  // A hand-over can land one scope read after the surface draws: the route
  // wait of a new settings route is a dialog too. Wait for the final address
  // first, as `openDialog` does, then check that it stays.
  const settleAddress = async (search: string) => {
    await expect(page).toHaveURL((url) => url.search === search);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
  };
  expect(new URL(page.url()).search).toBe(`?${query}`);
  await page.getByLabel("Project name").fill("Rotation draft");

  // A tablet rotated into landscape: the dialog takes over from the layer.
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.getByRole("dialog")).toBeVisible();
  await settleAddress(`?${query}&settings=project`);
  expect(new URL(page.url()).search).toBe(`?${query}&settings=project`);
  await expect(page.getByLabel("Project name")).toHaveValue("Rotation draft");
  await expect.poll(() => unloadGuard(page)).toBe(true);

  // And back again.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await settleAddress(`?${query}`);
  expect(new URL(page.url()).search).toBe(`?${query}`);
  await expect(page.getByLabel("Project name")).toHaveValue("Rotation draft");
  await expect.poll(() => unloadGuard(page)).toBe(true);

  // A rapid pair of surface changes leaves only the newest exact replacement.
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.getByRole("dialog")).toBeVisible();
  await settleAddress(`?${query}&settings=project`);
  expect(new URL(page.url()).search).toBe(`?${query}&settings=project`);
  await expect(page.getByLabel("Project name")).toHaveValue("Rotation draft");
});

const renames = [
  ["account", "Account", "Name", "save-account", "Grace Hopper"],
  ["workspace", "Workspace", "Workspace name", "save-workspace", "Renamed Org"],
  ["project", "Project", "Project name", "save-project", "renamed-project"],
] as const;

test("a saved change is not something left to discard", async ({ page }) => {
  await signIn(page, freshEmail("saved-clean"));
  const projectId = await createProject(page, "Save Org");
  const viewer = await projectPathFor(page, projectId);
  for (const [pane, , label, save, value] of renames) {
    await openDialog(page, `${viewer}?settings=${pane}`);
    await page.getByLabel(label).fill(value);
    await expect.poll(() => unloadGuard(page)).toBe(true);
    await page.getByTestId(save).click();
    // The server answers with what it stored, and the field measures against
    // it: nothing is left that closing could discard.
    await expect.poll(() => unloadGuard(page), { timeout: 15_000 }).toBe(false);
    await page.getByTestId("close-settings").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL((url) => url.pathname === viewer);
  }
});

test("a reload after a save is not held back", async ({ page }) => {
  await signIn(page, freshEmail("saved-reload"));
  const projectId = await createProject(page, "Reload Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=account"),
  );
  await page.getByLabel("Name", { exact: true }).fill("Ada Lovelace");
  await page.getByTestId("save-account").click();
  await expect.poll(() => unloadGuard(page), { timeout: 15_000 }).toBe(false);
  const prompts = await leaveDocument(page, () => page.reload());
  expect(prompts).toEqual([]);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Ada Lovelace",
  );
});

test("a saved change on the compact layer is not left to discard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, freshEmail("saved-compact"));
  await createProject(page, "Compact Org");
  await open(page, "/settings/account");
  await page.getByLabel("Name", { exact: true }).fill("Compact Save");
  await expect.poll(() => unloadGuard(page)).toBe(true);
  await page.getByTestId("save-account").click();
  await expect.poll(() => unloadGuard(page), { timeout: 15_000 }).toBe(false);
  await page.getByRole("link", { name: "Settings" }).click();
  await page.waitForURL((url) => url.pathname === "/settings");
});

test("a matching confirmation stays clean on any pane", async ({ page }) => {
  await signIn(page, freshEmail("settled"));
  const projectId = await createProject(page, "Settled Org");
  const viewer = await projectPathFor(page, projectId);
  await openDialog(page, `${viewer}?settings=danger`);
  const asked = await page.getByText(/^Type .+ to confirm$/).textContent();
  const name = (asked ?? "").replace(/^Type /, "").replace(/ to confirm$/, "");
  await page.getByLabel(/^Type /).fill(name);
  await expect.poll(() => unloadGuard(page)).toBe(false);
  // The verdict is a comparison, so it does not leave with the pane.
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await expect.poll(() => unloadGuard(page)).toBe(false);
  await page.getByTestId("close-settings").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
