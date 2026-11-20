import { workspaceAddress } from "./addresses";
import { failWith } from "./api-responses";
import { installedRepository, suspendInstallation } from "./database-fixture";
import {
  currentWorkspaceId,
  expect,
  freshEmail,
  open,
  signIn,
  test,
} from "./harness";
import { createProject } from "./project-setup";

test("an unavailable installation offers another attempt", async ({ page }) => {
  await signIn(page, freshEmail("suspended-compact"));
  await open(page, "/new");
  await page.getByLabel("Workspace name").fill("Suspended Org");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL(/\/install/);

  await failWith(
    page,
    "**/v1/github/installations",
    "POST",
    "operation-unavailable",
  );
  await page.getByTestId("install-app").click();
  const refusal = page.getByTestId("install-refusal");
  await expect(refusal).toBeVisible();
  await expect(refusal).toContainText("App installation opens soon");
  // No retry helps, so the refusal invents no retry time.
  await expect(refusal).not.toContainText("Try again shortly.");
  await expect(page.getByTestId("install-app")).toHaveText("Try again");
});

test("a suspended installation is kept out of the repository picker", async ({
  page,
}) => {
  await signIn(page, freshEmail("picker-compact"));
  const projectId = await createProject(page, "Picker Org");
  const workspaceId = await currentWorkspaceId(page);
  // A bound installation GitHub has suspended, exactly as reconciliation
  // records one. A suspended installation reads no repository, so the step
  // that would list them is not where the reader belongs.
  suspendInstallation(workspaceId);

  const workspace = await workspaceAddress(page, workspaceId);
  await open(page, `${workspace.path}/-/new`);
  await page.waitForURL((url) => url.pathname === "/install");
  await expect(page.getByText(installedRepository)).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Resume on GitHub" }),
  ).toBeVisible();
  expect(projectId.length).toBeGreaterThan(0);
});
