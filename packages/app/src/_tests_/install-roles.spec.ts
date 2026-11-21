import type { Page } from "@playwright/test";

import { expect, freshEmail, open, signIn, test } from "./harness";
import { addMember, switchSession } from "./members";
import { createWorkspace, expectCompletedSteps } from "./setup-walks";

/**
 * The install step draws for the reader's role. Only an owner or an admin can
 * install the App, so a member is told who can and keeps the way to the CLI
 * form, and a reviewer, who creates no project, is told who makes the first.
 * Neither page is a dead end: both keep the strip and the way back.
 */

/** A workspace with nothing installed, and a second person in it. */
async function joinedAs(
  page: Page,
  label: string,
  role: "member" | "reviewer",
): Promise<string> {
  await signIn(page, freshEmail(label + "-owner"));
  const workspaceId = await createWorkspace(page, label + " Org");
  const email = freshEmail(label);
  const memberSession = await addMember(page, workspaceId, email, role);
  await switchSession(page, memberSession);
  await open(page, `/install?workspaceId=${workspaceId}`);
  return workspaceId;
}

test("a member is asked to have an owner or admin install the App", async ({
  page,
}) => {
  await joinedAs(page, "install-member", "member");
  await expect(
    page.getByRole("heading", { level: 1, name: "Install the Mokly app" }),
  ).toBeVisible();
  await expect(
    page.getByText("Ask an owner or admin to install it."),
  ).toBeVisible();
  await expect(page.getByTestId("install-app")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back" })).toBeVisible();
  await expectCompletedSteps(page, ["Workspace"]);

  // A member can create a project, so the way round the App is theirs too.
  await page
    .getByRole("link", { name: "Publish with the CLI instead" })
    .click();
  await page.waitForURL((url) => /^\/[^/]+\/-\/new\/cli$/.test(url.pathname));
  await expect(
    page.getByRole("heading", { level: 1, name: "Publish with the CLI" }),
  ).toBeVisible();
});

test("a reviewer is told the workspace has no projects yet", async ({
  page,
}) => {
  await joinedAs(page, "install-reviewer", "reviewer");
  await expect(
    page.getByRole("heading", { level: 1, name: "No projects yet" }),
  ).toBeVisible();
  await expect(
    page.getByText("Ask an owner or admin to create the first project."),
  ).toBeVisible();
  await expect(page.getByTestId("install-app")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Publish with the CLI instead" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back" })).toBeVisible();
});
