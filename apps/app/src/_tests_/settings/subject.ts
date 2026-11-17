import {
  createProject,
  currentWorkspaceId,
  expect,
  freshEmail,
  openDialog,
  projectAddress,
  signIn,
} from "../harness";
import { addMember } from "../members";
import { makePrivate } from "../visibility";
import type { Page } from "@playwright/test";
import { pressWrite } from "../writes";

/** The one workspace, project, colleague and token every write acts on. */
export interface Subject {
  projectId: string;
  projectName: string;
  projectPath: string;
  projectSlug: string;
  accountName: string;
  /** The workspace the project belongs to, for a write that names it. */
  workspaceId: string;
  workspaceName: string;
  workspacePath: string;
  workspaceSlug: string;
  colleague: string;
}

/**
 * Everything the pane family's writes need before any of them is exercised: an
 * workspace with a second real person in it, a project, a saved account name
 * and a token to revoke.
 *
 * Two of the name forms have nothing saved yet, and a form with an empty saved
 * value cannot tell "put it back" from "empty it", so a name is saved here
 * rather than by the test that undoes one.
 */
export async function prepare(page: Page, label: string): Promise<Subject> {
  await signIn(page, freshEmail(label));
  const projectId = await createProject(page, `${label} Org`);
  const workspaceId = await currentWorkspaceId(page);
  // The visibility write under test is "Make public", which needs the private
  // project a Team workspace creates.
  await makePrivate(page, projectId);
  const address = await projectAddress(page, projectId);
  const colleague = freshEmail(`${label}-colleague`);
  await addMember(page, workspaceId, colleague);

  const accountName = "Undo Reader";
  await openDialog(page, `${address.path}?settings=account`);
  await page.getByLabel("Name", { exact: true }).fill(accountName);
  await pressWrite(
    page,
    page.getByTestId("save-account"),
    "PATCH",
    "/v1/account",
  );
  await expect(page.getByTestId("save-account")).toHaveText("Save changes");
  await expect(page.getByTestId("save-account")).toBeDisabled();

  // The revoke confirmation needs something to revoke.
  await openDialog(page, `${address.path}?settings=tokens`);
  await page.getByTestId("new-token").click();
  await page.getByLabel("Token name").fill(`${label} token`);
  await page.getByTestId("create-token").click();
  await expect(page.getByTestId("copy-token")).toBeVisible();
  await page.getByTestId("token-done").click();

  // A field waits in its frame, empty and read only, while the settings scope
  // loads, so each name is read once its field takes input.
  await openDialog(page, `${address.path}?settings=project`);
  await expect(page.getByLabel("Project name")).toBeEditable();
  const projectName = await page.getByLabel("Project name").inputValue();
  await openDialog(page, `${address.path}?settings=workspace`);
  await expect(page.getByLabel("Workspace name")).toBeEditable();
  const workspaceName = await page.getByLabel("Workspace name").inputValue();
  return {
    projectId,
    projectName,
    projectPath: address.path,
    projectSlug: address.slug,
    accountName,
    workspaceId,
    workspaceName,
    workspacePath: `/${encodeURIComponent(address.workspaceSlug)}`,
    workspaceSlug: address.workspaceSlug,
    colleague,
  };
}
