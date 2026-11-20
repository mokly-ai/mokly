import { projectAddress, projectQueryPathFor } from "../addresses";
import {
  expect,
  freshEmail,
  openDialog,
  signIn,
  test,
  unloadGuard,
} from "../harness";
import { apiOrigin } from "../origins";
import { createProject } from "../project-setup";
import { makePrivate } from "../visibility";
import { pressWrite } from "../writes";

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
