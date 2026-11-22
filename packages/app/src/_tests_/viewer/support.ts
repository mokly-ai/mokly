import type { Locator, Page } from "@playwright/test";

import { projectAddress, publicationPathFor } from "../addresses";
import { expect, freshEmail, signIn } from "../harness";
import { createProject } from "../project-setup";
import { createToken, publish } from "../publish";
import type { PublishInput } from "../publish";
import { makePrivate, setVisibility } from "../visibility";

/** One signed-in reader, their project and one publication of the fixture. */
export interface PublishedProject {
  projectId: string;
  workspaceName: string;
  workspaceSlug: string;
  projectSlug: string;
  projectPath: string;
  publicationId: string;
  publicationPath: string;
  catalogueUrl: string | null;
  token: string;
  /** The address this reader signed in with, which is also their label. */
  email: string;
}

/**
 * Wait until the published package has loaded its stage and the cloud slots
 * that both compositions fill: the centre slot with the publication and the
 * end slot. The compact bar leaves the start slot empty.
 * A transient index read is recovered through the stage card's own Try again
 * once; a repeated failure remains visible and fails the readiness assertion.
 * Tests that start from a settled viewer wait here; tests of loading, access,
 * failure and the slot handoff do not wait on this boundary.
 */
export async function publishedViewerReady(page: Page): Promise<void> {
  const viewer = page.locator(
    ".fo-published-viewer .mokly-viewer[data-mokly-shell]",
  );
  const failed = page
    .locator(".fo-stage-card")
    .filter({ hasText: "This publication couldn’t open" });
  await expect(viewer.or(failed)).toBeVisible();
  if (await failed.isVisible()) {
    await failed.getByRole("button", { name: "Try again" }).click();
  }
  await expect(viewer).toBeVisible();
  await expect(viewer.locator(".mokly-stage-host")).toBeVisible();
  for (const slot of ["topBarCenter", "topBarEnd"]) {
    await expect(
      viewer
        .locator(`[data-mokly-slot="${slot}"] [data-mkc-viewer-slot]`)
        .first(),
    ).toBeVisible();
  }
}

/** The Notice variant reads both consumer lists from its parent's detail. */
export async function expectParentUsage(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  const usage = page.getByRole("tabpanel", { name: "Usage", exact: true });
  await expect(usage.getByRole("heading")).toHaveText([
    "Used by",
    "Affected screens and components",
  ]);
  await expect(usage.getByRole("list")).toHaveCount(2);
  for (const list of await usage.getByRole("list").all()) {
    await expect(list.getByRole("link")).toHaveText(["Finish", "Start"]);
    await expect(list.getByRole("listitem")).toHaveText([
      "FinishDirect use · 1 instance · 2 views",
      "StartDirect use · 1 instance · 2 views",
    ]);
  }
}

/**
 * Wait for the route to finish with an address before asserting what it kept.
 *
 * A viewer value the route corrects is corrected only once the publication has
 * resolved, so anything asserted before that describes the address the reader
 * asked for rather than the one the route produced — and a polling matcher
 * takes the first moment that holds, which is that one. Every test whose
 * subject is the settled address waits through this first, and what it waits
 * for is the correction itself: the value the route must remove.
 */
export async function corrected(page: Page, asked: RegExp): Promise<void> {
  await expect(page, "the route corrects what it was given").not.toHaveURL(
    asked,
  );
}

/** Sign a new reader in, create their project, and publish the fixture to it. */
export async function publishedProject(
  page: Page,
  label: string,
  input: PublishInput = { branch: "main" },
): Promise<PublishedProject> {
  const email = freshEmail(label);
  const workspaceName = label + " Org";
  await signIn(page, email);
  const projectId = await createProject(page, workspaceName);
  // Every viewer scenario starts from the private project a Team workspace
  // creates; the ones that read a public publication make it public themselves.
  await makePrivate(page, projectId);
  const token = await createToken(page, projectId);
  const published = await publish(token, projectId, input);
  const address = await projectAddress(page, projectId);
  return {
    projectId,
    workspaceName,
    workspaceSlug: address.workspaceSlug,
    projectSlug: address.slug,
    projectPath: address.path,
    publicationId: published.id,
    publicationPath: await publicationPathFor(page, projectId, published.id),
    catalogueUrl: published.catalogueUrl,
    token,
    email,
  };
}

/**
 * Make one project public through the API the project pane writes with, so a
 * test can read what a public publication actually says rather than describing
 * it.
 */
export async function makePublic(page: Page, projectId: string): Promise<void> {
  await setVisibility(page, projectId, "public");
}

/** Hold a successful real read until a test has checked the pending body. */
export async function holdViewerRead(
  page: Page,
  matches: (url: URL) => boolean,
): Promise<{ seen: () => boolean; release: () => void }> {
  const pending = Promise.withResolvers<void>();
  let held = false;
  await page.route(matches, async (route) => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    held = true;
    await pending.promise;
    await route.fulfill({ response });
  });
  return { seen: () => held, release: () => pending.resolve() };
}

/** Share offers no link, empty state, or publishing action while it waits. */
export async function expectSharePreparing(panel: Locator): Promise<void> {
  await expect(
    panel.getByText("Preparing the publication link…", { exact: true }),
  ).toBeVisible();
  // The link's field waits in its own frame and holds the read's name where
  // the link would be, and Copy link waits disabled, as Wait in
  // `folio-chrome.md` defines: the panel offers no link to copy.
  await expect(panel.getByLabel("Publication link")).toHaveValue("");
  await expect(panel.getByTestId("share-copy")).toBeDisabled();
  await expect(
    panel.getByText("No publications yet", { exact: true }),
  ).toHaveCount(0);
  await expect(panel.getByTestId("share-set-up-publishing")).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: "Set up publishing", exact: true }),
  ).toHaveCount(0);
}
