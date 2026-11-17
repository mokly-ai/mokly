import type { Page } from "@playwright/test";

import {
  createProject,
  currentWorkspaceId,
  expect,
  freshEmail,
  open,
  projectPathFor,
  publicationPathFor,
  ready,
  signIn,
  test,
} from "../harness";
import { addMember, switchSession } from "../members";
import { apiOrigin } from "../origins";
import { createToken, publish } from "../publish";
import {
  expectSharePreparing,
  holdViewerRead,
  publishedProject,
} from "./support";

/** A signed-in reader with a project whose entry state this test exercises. */
async function project(page: Page, label: string): Promise<string> {
  await signIn(page, freshEmail(label));
  return createProject(page, label + " Org");
}

test("an unavailable publication offers the switcher as the way back", async ({
  page,
}) => {
  const projectId = await project(page, "unavailable");
  const token = await createToken(page, projectId);
  await publish(token, projectId, { branch: "main" });

  await open(
    page,
    await publicationPathFor(
      page,
      projectId,
      "01994f10-0000-7000-8000-0000000000ac",
    ),
  );
  await expect(page.getByText("This publication is unavailable")).toBeVisible();
  await expect(page.getByTestId("viewer-share")).toBeDisabled();
  await page.getByTestId("stage-choose-publication").click();
  await expect(page.getByTestId("viewer-panel-switcher")).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "main" }),
  ).toBeVisible();
});

test("Set up publishing is offered to an administrator and named for a member", async ({
  page,
}) => {
  const projectId = await project(page, "unpublished");
  await open(page, await projectPathFor(page, projectId));
  const canvas = page.locator(".fo-stage-canvas");
  await expect(canvas.getByText("No publications yet")).toBeVisible();
  await expect(canvas.getByTestId("set-up-publishing")).toBeVisible();
  await expect(canvas.getByTestId("stage-choose-publication")).toBeVisible();
  // The chrome stays mounted in every state, so the reader is never outside
  // the viewer.
  await expect(page.getByTestId("viewer-settings")).toBeVisible();
});

test("a member is told who publishes, and is offered no way to do it", async ({
  page,
}) => {
  const owner = freshEmail("owner-member");
  const member = freshEmail("member-reader");
  await signIn(page, owner);
  const projectId = await createProject(page, "Member Org");
  const workspaceId = await currentWorkspaceId(page);
  const memberSession = await addMember(page, workspaceId, member, "member");

  await switchSession(page, memberSession);
  const projectRoute = await projectPathFor(page, projectId);
  await open(page, projectRoute);
  const canvas = page.locator(".fo-stage-canvas");
  await expect(
    canvas.getByText("An administrator publishes this project."),
  ).toBeVisible();
  await expect(canvas.getByTestId("set-up-publishing")).toHaveCount(0);
  await expect(canvas.getByTestId("stage-choose-publication")).toBeVisible();

  await page.getByTestId("stage-choose-publication").click();
  const switcher = page.getByTestId("viewer-panel-switcher");
  await expect(switcher.getByText("No branches yet")).toBeVisible();
  await expect(switcher.getByTestId("switcher-set-up-publishing")).toHaveCount(
    0,
  );
  await expect(
    switcher.getByRole("button", { name: "Set up publishing", exact: true }),
  ).toHaveCount(0);

  // Hold the real read so Share stays open before the address closes it.
  // Until the entry resolves, Share only prepares its link.
  let release: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const branches = `**/v1/projects/${projectId}/branches*`;
  await page.route(branches, async (route) => {
    await pending;
    await route.continue();
  });
  try {
    await open(page, `${projectRoute}?panel=share`);
    const share = page.getByTestId("viewer-panel-share");
    await expect(share).toBeVisible();
    await expectSharePreparing(share);
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
  await expect(page.getByTestId("viewer-panel-share")).toHaveCount(0);
  await expect(page).not.toHaveURL(/panel=share/);
});

test("every panel says what it has, on a project with nothing published", async ({
  page,
}) => {
  const projectId = await project(page, "empty-panels");
  const projectRoute = await projectPathFor(page, projectId);
  // While the publication read is pending, Share prepares its link. Once the
  // read answers with none, the address closes it and disables its trigger.
  await open(page, `${projectRoute}?panel=share`);
  await expect(page).toHaveURL((url) => url.pathname === projectRoute);
  await expect(page.getByTestId("viewer-panel-share")).toHaveCount(0);

  await open(page, `${projectRoute}?panel=history`);
  const history = page.getByTestId("viewer-panel-history");
  await expect(history).toBeVisible();
  await expect(history.getByText("No earlier publications")).toBeVisible();
  await expect(history.getByTestId("history-choose-publication")).toBeVisible();

  await open(page, `${projectRoute}?panel=switcher`);
  const switcher = page.getByTestId("viewer-panel-switcher");
  await expect(switcher).toBeVisible();
  // No branches and no search: the recovery offered has to be one the reader
  // can actually perform.
  await expect(switcher.getByText("No branches yet")).toBeVisible();
  await expect(switcher.getByText("Clear the search")).toHaveCount(0);
  await expect(
    switcher.getByTestId("switcher-set-up-publishing"),
  ).toBeVisible();

  await open(page, `${projectRoute}?panel=projects`);
  const projects = page.getByTestId("viewer-panel-projects");
  await expect(projects).toBeVisible();
  await expect(projects.getByTestId("projects-create")).toBeVisible();

  // The Share trigger is disabled. An address can open Share until the entry
  // resolves, then the address correction closes it.
  await expect(page.getByTestId("viewer-share")).toBeDisabled();
});

test("Share prepares its link while the real publication entry resolves", async ({
  page,
}) => {
  const made = await publishedProject(page, "share-resolving");
  const held = await holdViewerRead(
    page,
    (url) =>
      url.origin === apiOrigin &&
      url.pathname.endsWith(`/publications/${made.publicationId}`),
  );
  try {
    await page.goto(
      `${made.publicationPath}?catalogueScreen=start&panel=share`,
      {
        waitUntil: "domcontentloaded",
      },
    );
    await ready(page);
    await expect.poll(held.seen).toBe(true);
    const panel = page.getByTestId("viewer-panel-share");
    await expect(panel).toBeVisible();
    await expectSharePreparing(panel);
    held.release();
    await expect(panel.getByLabel("Publication link")).toHaveValue(
      /catalogueScreen=start/,
    );
    await expect(
      panel.getByText("No publications yet", { exact: true }),
    ).toHaveCount(0);
  } finally {
    held.release();
    await page.unrouteAll({ behavior: "wait" });
  }
});
