import type { Locator, Page } from "@playwright/test";

import { projectPathFor, pullRequestPathFor } from "../addresses";
import { fillPullRequest } from "../database-fixture";
import { expect, freshEmail, open, signIn, test } from "../harness";
import { createProject } from "../project-setup";
import { publish } from "../publish";

import { pullRequest } from "./fixtures";
import { holdReads, projectRead } from "./held-reads";
import {
  publicationReference,
  publishedProject,
  publishedViewerReady,
} from "./support";

/**
 * Every viewer wait draws the layout that it waits for, as Wait in
 * `folio-chrome.md` defines it: the route's reads draw the cloud frame, its
 * known controls disabled, over the stage's waiting card; the stage's own read
 * titles that card with the read; and each panel draws its own groups, with
 * one placeholder row in each list. Each read is held here until its wait has
 * been seen.
 */

/** The cloud frame while the route reads the session or the project. */
async function expectFrameWait(page: Page): Promise<void> {
  // The page's one heading names the read for screen readers, and nothing
  // else says it: the stage's card waits with a bar for its title.
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveCount(1);
  await expect(heading).toHaveAccessibleName("Opening your project…");
  await expect(page.getByText("Opening your project…")).toHaveCount(1);
  // The controls whose labels are known wait in their places, disabled.
  for (const name of ["History", "Share"])
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
}

/** The read's name, which screen readers hear inside a panel. */
function heardIn(panel: Locator): Locator {
  return panel.getByRole("main").getByRole("status");
}

/** The page's one heading, which a panel's wait keeps as the panel's title. */
async function expectOneHeading(page: Page, title?: string): Promise<void> {
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveCount(1);
  if (title !== undefined) await expect(heading).toHaveText(title);
}

test("the viewer waits in the cloud frame, then in the stage's waiting card", async ({
  page,
}) => {
  const email = freshEmail("viewer-waits");
  await signIn(page, email);
  const projectId = await createProject(page, "Viewer Waits Org");
  const path = await projectPathFor(page, projectId);
  await open(page, path);
  const settled = page.getByRole("heading", {
    level: 2,
    name: "No publications yet",
  });
  await expect(settled).toBeVisible();

  // The next load holds each of its reads in turn: the session, the project,
  // then the branches the standalone entry resolves.
  const session = await holdReads(
    page,
    (url) => url.pathname === "/v1/session",
  );
  const project = await holdReads(page, projectRead);
  const entry = await holdReads(
    page,
    (url) => url.pathname === `/v1/projects/${projectId}/branches`,
  );
  await page.reload();
  await session.arrived;
  await expectFrameWait(page);
  session.release();

  // Once the session has answered, the account names the reader, disabled.
  await project.arrived;
  await expectFrameWait(page);
  await expect(page.getByRole("button", { name: email })).toBeDisabled();
  project.release();

  // The stage's waiting card names the stage's own read in its title, under
  // the page's one heading.
  await entry.arrived;
  await expectOneHeading(page);
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { level: 2, name: "Loading publication…" }),
  ).toBeVisible();
  // The standalone address names no branch, so the reference trigger waits as
  // a placeholder in its own frame, and only the state beside it says Loading.
  const trigger = page.getByTestId("viewer-publication");
  await expect(trigger).toHaveCount(0);
  await expect(page.getByText("Loading", { exact: true })).toHaveCount(1);
  entry.release();
  await expect(settled).toBeVisible();
  await expect(trigger).toBeVisible();
});

/*
 * The pull request alias and the panels wait on one project: its `main`
 * publication, and a pull request's publication on `feature`.
 */
test("a pull request alias names its pull request while it waits, and each panel waits in its own groups", async ({
  page,
}) => {
  const made = await publishedProject(page, "panel-waits");
  const project = "/v1/projects/" + made.projectId;
  const publication = project + "/publications/" + made.publicationId;
  fillPullRequest(made.projectId, pullRequest({ number: 7 }));
  const pull = await publish(made.token, made.projectId, {
    branch: "feature",
    pullRequest: 7,
  });

  await test.step("a pull request alias names its pull request until its publication's address takes over", async () => {
    const pulls = await holdReads(
      page,
      (url) => url.pathname === project + "/pull-requests",
    );
    const publicationRead = await holdReads(
      page,
      (url) => url.pathname === project + "/publications/" + pull.id,
    );
    const trigger = page.getByTestId("viewer-publication");
    const loading = page.getByText("Loading", { exact: true });
    await open(page, await pullRequestPathFor(page, made.projectId, 7));

    // While the alias resolves, its own address names the pull request.
    await pulls.arrived;
    await expect(publicationReference(page)).toHaveText("#7");
    await expect(loading).toHaveCount(1);
    pulls.release();

    // The publication's address names no reference, so while the publication
    // is read the trigger waits as a placeholder in its own frame.
    await publicationRead.arrived;
    await expect(page).toHaveURL(new RegExp("publications/" + pull.id));
    await expect(trigger).toHaveCount(0);
    await expect(loading).toHaveCount(1);
    publicationRead.release();
    await expect(publicationReference(page)).toHaveText("#7 Host the viewer");
  });

  await test.step("each panel waits in its own groups, with one placeholder row in each list", async () => {
    await open(page, made.publicationPath);
    await publishedViewerReady(page);

    // The switcher: each group waits with a bar for its label and one row,
    // which is no link yet.
    let read = await holdReads(
      page,
      (url) => url.pathname === project + "/branches",
    );
    await page.getByTestId("viewer-publication").click();
    let panel = page.getByTestId("viewer-panel-switcher");
    await read.arrived;
    await expectOneHeading(page, "Branches and pull requests");
    await expect(heardIn(panel)).toHaveText("Loading branches…");
    for (const name of ["Branches", "Pull requests"])
      await expect(
        panel.getByRole("list", { name }).getByRole("listitem"),
      ).toHaveCount(1);
    await expect(panel.getByRole("listitem").getByRole("link")).toHaveCount(0);
    read.release();
    await expect(
      panel.getByRole("listitem").filter({ hasText: "main" }),
    ).toBeVisible();
    await page.getByTestId("close-switcher").click();

    // History: one row stands for this reference's publications.
    read = await holdReads(
      page,
      (url) => url.pathname === project + "/history",
    );
    await page.getByTestId("viewer-history").click();
    panel = page.getByTestId("viewer-panel-history");
    await read.arrived;
    await expectOneHeading(page, "Publication history");
    await expect(heardIn(panel)).toHaveText("Loading publication history…");
    await expect(
      panel
        .getByRole("list", { name: "Publications of main" })
        .getByRole("listitem"),
    ).toHaveCount(1);
    await expect(panel.getByRole("listitem").getByRole("link")).toHaveCount(0);
    read.release();
    await expect(panel.getByText("Current publication")).toBeVisible();
    await page.getByTestId("close-history").click();

    // Projects: one workspace group stands for the reader's workspaces.
    read = await holdReads(page, (url) => url.pathname === "/v1/workspaces");
    await page.getByTestId("viewer-project").click();
    panel = page.getByTestId("viewer-panel-projects");
    await read.arrived;
    await expectOneHeading(page, "Projects");
    await expect(heardIn(panel)).toHaveText("Loading projects…");
    await expect(
      panel.getByRole("list", { name: "Projects" }).getByRole("listitem"),
    ).toHaveCount(1);
    await expect(panel.getByRole("listitem").getByRole("link")).toHaveCount(0);
    read.release();
    await expect(panel.getByText(made.workspaceName)).toBeVisible();
    await page.getByTestId("close-projects").click();

    // Share: the link's field names its read in its own frame, the project's
    // visibility stays, Copy link waits disabled, and the screens keep the
    // whole catalogue's name over one row.
    const link = await holdReads(
      page,
      (url) => url.pathname === publication + "/share",
    );
    const screens = await holdReads(
      page,
      (url) => url.pathname === publication + "/screens",
    );
    await page.getByTestId("viewer-share").click();
    panel = page.getByTestId("viewer-panel-share");
    await link.arrived;
    await screens.arrived;
    await expectOneHeading(page, "Share");
    const field = panel.getByLabel("Publication link");
    await expect(field).toHaveAccessibleDescription(
      "Preparing the publication link…",
    );
    await expect(field).not.toBeEditable();
    await expect(panel.getByText("Private", { exact: true })).toBeVisible();
    await expect(panel.getByTestId("share-copy")).toBeDisabled();
    await expect(heardIn(panel)).toHaveText("Loading screens…");
    await expect(
      panel.getByText("Whole catalogue", { exact: true }),
    ).toBeVisible();
    link.release();
    screens.release();
    await expect(field).not.toHaveValue("");
    await expect(panel.getByTestId("share-copy")).toBeEnabled();
  });
});
