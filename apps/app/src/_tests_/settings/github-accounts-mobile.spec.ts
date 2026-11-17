import {
  disconnectInstallation,
  installedAccount,
  manageUrl,
  suspendInstallation,
} from "../database-fixture";
import {
  createProject,
  currentWorkspaceId,
  expect,
  freshEmail,
  open,
  signIn,
  test,
  workspaceSettingsPathFor,
} from "../harness";

/**
 * On a compact surface the GitHub accounts pane is a full-screen layer, and a
 * row's three-dot menu and the removal it leads to are bottom sheets over it,
 * each titled for what it asks about and each closed by its own way out.
 */
test("a compact account row opens its menu and its removal as sheets", async ({
  page,
}) => {
  await signIn(page, freshEmail("github-sheet"));
  await createProject(page, "Github Sheet Org");
  const workspaceId = await currentWorkspaceId(page);
  await open(page, await workspaceSettingsPathFor(page, workspaceId, "github"));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 1, name: "GitHub accounts" }),
  ).toBeVisible();

  const trigger = page.getByRole("button", {
    name: "Actions for " + installedAccount,
  });
  expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await trigger.click();
  const sheet = page.getByRole("dialog", {
    name: installedAccount,
    exact: true,
  });
  await expect(sheet).toBeVisible();
  const viewport = page.viewportSize()!;
  const box = (await sheet.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBe(viewport.height);
  await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(trigger).toBeFocused();

  // Choosing a row closes the menu before the question it opens.
  await trigger.click();
  await page.getByRole("menuitem", { name: "Remove", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: installedAccount, exact: true }),
  ).toHaveCount(0);
  const question = page.getByRole("dialog", {
    name: "Remove " + installedAccount + "?",
  });
  await expect(question).toBeVisible();
  await question.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(question).toHaveCount(0);
  await expect(page.getByText("No GitHub accounts yet")).toBeVisible();
});

test("the compact routes name a suspended account and its way back", async ({
  page,
}) => {
  // The narrowest layer the product supports: a row and its recovery share one
  // column here, which is where a second line would run past the page.
  await page.setViewportSize({ width: 320, height: 800 });
  await signIn(page, freshEmail("mobile-suspended"));
  await createProject(page, "Susp Org");
  const workspaceId = await currentWorkspaceId(page);
  suspendInstallation(workspaceId);

  await open(
    page,
    await workspaceSettingsPathFor(page, workspaceId, "workspace"),
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Workspace" }),
  ).toBeVisible();
  await expect(page.getByTestId("github-accounts-fact")).toContainText(
    installedAccount + " · Suspended",
  );

  await open(page, await workspaceSettingsPathFor(page, workspaceId, "github"));
  await expect(
    page.getByRole("heading", { level: 1, name: "GitHub accounts" }),
  ).toBeVisible();
  const resume = page.getByRole("link", { name: "Resume on GitHub" });
  await expect(resume).toHaveAttribute("href", manageUrl);
  // Somebody else's page, so it opens beside this one rather than taking the
  // reader out of a layer that may be holding a name they have not saved.
  await expect(resume).toHaveAttribute("target", "_blank");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "nothing runs past the narrowest layer").toBeLessThanOrEqual(
    1,
  );
});

test("the compact workspace route says when nothing is connected", async ({
  page,
}) => {
  await signIn(page, freshEmail("mobile-absent"));
  await createProject(page, "Abs Org");
  const workspaceId = await currentWorkspaceId(page);
  // The App was installed to create the project, and then removed on GitHub.
  disconnectInstallation(workspaceId);
  await open(
    page,
    await workspaceSettingsPathFor(page, workspaceId, "workspace"),
  );
  await expect(page.getByTestId("github-accounts-fact")).toContainText("None");
  await expect(
    page.getByRole("link", { name: "Resume on GitHub" }),
  ).toHaveCount(0);
});
