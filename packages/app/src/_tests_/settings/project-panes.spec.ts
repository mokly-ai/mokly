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

import { holdsWhileSending, holdWrite } from "./held-writes";

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

test("visibility changes behind a confirmation that holds while it sends, whatever the name field holds", async ({
  page,
}) => {
  await signIn(page, freshEmail("visibility"));
  const projectId = await createProject(page, "Vis Org");
  await makePrivate(page, projectId);
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=project"),
  );
  // The field waits in its frame while the settings scope loads.
  await expect(page.getByLabel("Project name")).toBeEditable();
  const name = await page.getByLabel("Project name").inputValue();
  const change = page.getByTestId("change-visibility");

  // Each case starts from a private project, so the project is made private
  // again between them with the same control.
  const privateAgain = async () => {
    await change.click();
    await page.getByTestId("confirm-visibility").click();
    await expect(change).toHaveText("Make public");
  };

  await test.step("visibility changes behind a confirmation and offers the way back", async () => {
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

  await privateAgain();

  await test.step("a visibility change holds while its write is in flight", async () => {
    const release = await holdWrite(page, "**/v1/projects/*", "PATCH");
    await change.click();
    await page.getByTestId("confirm-visibility").click();
    await expect(page.getByTestId("confirm-visibility")).toHaveText(
      "Making public…",
    );
    await holdsWhileSending(page, "Make " + name + " public?");

    release();
    await expect(page.getByTestId("confirm-visibility")).toHaveCount(0);
    await expect(change).toHaveText("Make private");
    await page.unrouteAll();
  });

  await privateAgain();

  await test.step("an emptied name does not block a visibility change", async () => {
    await page.getByLabel("Project name").fill("");
    await change.click();
    await page.getByTestId("confirm-visibility").click();
    // The confirmation closes, which is how the reader sees the change took.
    await expect(page.getByTestId("confirm-visibility")).toHaveCount(0);
    await expect(change).toHaveText("Make private");
  });

  // The name back as it was, with nothing typed, as the next case starts.
  await page.getByLabel("Project name").fill(name);
  await privateAgain();

  await test.step("changing visibility sends the visibility and not the name", async () => {
    const saved = await page.getByLabel("Project name").inputValue();

    await page.getByLabel("Project name").fill("Never pressed Save");
    await expect.poll(() => unloadGuard(page)).toBe(true);
    await change.click();
    await pressWrite(
      page,
      page.getByTestId("confirm-visibility"),
      "PATCH",
      `/v1/projects/${projectId}`,
    );
    await expect(change).toBeVisible();

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
});
