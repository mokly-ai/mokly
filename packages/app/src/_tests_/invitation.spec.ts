import type { Page } from "@playwright/test";

import { workspaceAddress, projectQueryPathFor } from "./addresses";
import { apiFailure, failWith } from "./api-responses";
import { magicLinkFor } from "./api-server";
import {
  currentWorkspaceId,
  expect,
  freshEmail,
  open,
  openDialog,
  openMagicLink,
  signIn,
  test,
} from "./harness";
import { createProject } from "./project-setup";
import { admitLinkRequest } from "./sign-in-links";

async function expectErrorReference(page: Page) {
  const details = page.locator(".fo-error-details");
  await expect(details).toHaveCount(1);
  await expect(details).not.toHaveAttribute("open");
  await details.getByText("Details", { exact: true }).click();
  await expect(details.getByText("Reference")).toBeVisible();
  await expect(details.locator("code")).not.toBeEmpty();
}

test("the delivered invitation accepts the invited address after sign-in", async ({
  page,
}) => {
  await signIn(page, freshEmail("invitation-owner"));
  const projectId = await createProject(page, "Invitation Org");
  const workspaceId = await currentWorkspaceId(page);
  const workspaceSlug = (await workspaceAddress(page, workspaceId)).slug;
  const membersPath = await projectQueryPathFor(
    page,
    projectId,
    "settings=members",
  );
  await openDialog(page, membersPath);
  const invited = freshEmail("invitation-recipient");
  await page.getByLabel("Email").fill(invited);
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText(invited)).toBeVisible();

  let invitation: string | undefined;
  await expect
    .poll(() => (invitation = magicLinkFor(invited)) !== undefined)
    .toBe(true);
  const link = new URL(invitation as string);
  expect(link.pathname).toMatch(
    /^\/workspaces\/[a-f0-9-]+\/invitations\/[a-f0-9-]+\/accept$/,
  );
  expect(link.pathname).toContain(workspaceId);
  const owner = await page.context().storageState();
  await page.context().clearCookies();
  await open(page, link.pathname);
  await page.waitForURL((url) => url.pathname === "/sign-in");
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(link.pathname);

  await page.getByLabel("Email").fill(invited);
  const issue = await admitLinkRequest(page, async () => {
    const sent = page.waitForResponse((answer) =>
      answer.url().endsWith("/v1/auth/magic-links"),
    );
    await page.getByTestId("email-entry").click();
    return sent;
  });
  expect(issue.status()).toBe(202);
  expect(issue.request().postDataJSON()).toMatchObject({
    returnTo: link.pathname,
  });
  let attempts = 0;
  await page.route("**/v1/workspaces/*/invitations/*/accept", (route) => {
    attempts += 1;
    if (attempts > 1) return route.continue();
    const { status, body } = apiFailure("unavailable");
    return route.fulfill({ status, contentType: "application/json", body });
  });
  await openMagicLink(page, invited);
  await expect(
    page.getByRole("heading", { name: "We couldn’t accept your invitation" }),
  ).toBeVisible();
  await expect(page.getByRole("alert").locator(".fo-state-title")).toHaveCount(
    0,
  );
  await expect(page.getByRole("alert").locator(".fo-sr-only")).toHaveText(
    "We couldn’t accept your invitation",
  );
  await expectErrorReference(page);
  await page.getByRole("button", { name: "Try again" }).click();
  await page.waitForURL((url) => url.pathname.startsWith(`/${workspaceSlug}/`));
  expect(attempts).toBe(2);

  await page.context().clearCookies();
  await page.context().addCookies(owner.cookies);
  await openDialog(page, membersPath);
  await expect(page.getByText(invited)).toBeVisible();
  await expect(page.getByText("Invited", { exact: true })).toHaveCount(0);
});

test("an accepted invitation survives a failed workspace read", async ({
  page,
}) => {
  await signIn(page, freshEmail("read-failure-owner"));
  await createProject(page, "Read Failure Org");
  const workspaceId = await currentWorkspaceId(page);
  const workspaceSlug = (await workspaceAddress(page, workspaceId)).slug;
  await openDialog(page, `/${workspaceSlug}/-/settings/members`);
  const invited = freshEmail("read-failure-recipient");
  await page.getByLabel("Email").fill(invited);
  await page.getByRole("button", { name: "Send invitation" }).click();
  let invitation: string | undefined;
  await expect
    .poll(() => (invitation = magicLinkFor(invited)) !== undefined)
    .toBe(true);
  const returnTo = new URL(invitation as string).pathname;
  await page.context().clearCookies();

  let accepts = 0;
  await page.route(
    `**/v1/workspaces/${workspaceId}/invitations/*/accept`,
    (route) => {
      accepts += 1;
      return route.continue();
    },
  );
  let reads = 0;
  const retryRead = Promise.withResolvers<void>();
  await page.route(`**/v1/workspaces/${workspaceId}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    reads += 1;
    if (reads > 1) {
      await retryRead.promise;
      return route.continue();
    }
    const { status, body } = apiFailure("unavailable");
    return route.fulfill({ status, contentType: "application/json", body });
  });

  await signIn(page, invited, returnTo);
  await expect(
    page.getByRole("heading", { name: "Invitation accepted" }),
  ).toBeVisible();
  await expect(page.getByText("We couldn’t open your workspace")).toBeVisible();
  await expectErrorReference(page);
  expect(accepts).toBe(1);
  await page.getByRole("button", { name: "Try again" }).click();
  try {
    // The heading says the invitation is accepted, so the waiting card's
    // title names the workspace read.
    await expect(page.locator('[aria-busy="true"]')).toContainText(
      "Opening your workspace",
    );
    await expect(
      page.getByRole("heading", { level: 2, name: "Opening your workspace…" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Invitation accepted" }),
    ).toBeVisible();
    await expect(page.getByText("Accepting invitation")).toHaveCount(0);
    expect(accepts).toBe(1);
  } finally {
    retryRead.resolve();
  }
  await page.waitForURL((url) => url.pathname.startsWith(`/${workspaceSlug}/`));
  expect(accepts).toBe(1);
  expect(reads).toBe(2);
});

test("an expired invitation asks the reader for a new one", async ({
  page,
}) => {
  await signIn(page, freshEmail("expired-invitation"));
  await failWith(
    page,
    "**/v1/workspaces/*/invitations/*/accept",
    "POST",
    "invitation-expired",
  );
  await open(
    page,
    "/workspaces/00000000-0000-0000-0000-000000000001/invitations/00000000-0000-0000-0000-000000000002/accept",
  );
  await expect(
    page.getByRole("heading", { name: "This invitation has expired" }),
  ).toBeVisible();
  await expect(page.getByText("Ask for a new invitation")).toBeVisible();
  await expectErrorReference(page);
  await page.getByRole("button", { name: "Open dashboard" }).click();
  await page.waitForURL((url) => url.pathname === "/new");
});

test("a different signed-in address can switch to the invited address", async ({
  page,
}) => {
  await signIn(page, freshEmail("wrong-invitation-account"));
  await createProject(page, "Switch Org");
  const workspaceId = await currentWorkspaceId(page);
  const workspaceSlug = (await workspaceAddress(page, workspaceId)).slug;
  await openDialog(page, `/${workspaceSlug}/-/settings/members`);
  const invited = freshEmail("switch-invitation-recipient");
  await page.getByLabel("Email").fill(invited);
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText(invited)).toBeVisible();
  let invitation: string | undefined;
  await expect
    .poll(() => (invitation = magicLinkFor(invited)) !== undefined)
    .toBe(true);
  const route = new URL(invitation as string).pathname;

  await open(page, route);
  await expect(
    page.getByRole("heading", {
      name: "This invitation isn’t available for this account",
    }),
  ).toBeVisible();
  await expectErrorReference(page);
  await page
    .getByRole("button", { name: "Sign in with another email" })
    .click();
  await page.waitForURL((url) => url.pathname === "/sign-in");
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(route);
  await page.getByLabel("Email").fill(invited);
  const sent = await admitLinkRequest(page, async () => {
    const sent = page.waitForResponse((answer) =>
      answer.url().endsWith("/v1/auth/magic-links"),
    );
    await page.getByTestId("email-entry").click();
    return sent;
  });
  expect(sent.request().postDataJSON()).toMatchObject({
    returnTo: route,
  });
  await openMagicLink(page, invited);
  await page.waitForURL((url) => url.pathname.startsWith(`/${workspaceSlug}/`));
});
