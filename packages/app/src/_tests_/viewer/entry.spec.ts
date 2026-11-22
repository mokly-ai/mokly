import type { Page } from "@playwright/test";

import {
  branchPathFor,
  projectPathFor,
  publicationPathFor,
  pullRequestPathFor,
} from "../addresses";
import { fillHistory, fillPullRequest } from "../database-fixture";
import { expect, freshEmail, open, signIn, test } from "../harness";
import { createProject } from "../project-setup";
import { createToken, publish } from "../publish";

import { pullRequest } from "./fixtures";
import { expectParentUsage, publishedViewerReady } from "./support";

/** A signed-in reader with a project whose publications this test writes. */
async function project(page: Page, label: string): Promise<string> {
  await signIn(page, freshEmail(label));
  return createProject(page, label + " Org");
}

test("standalone entry opens a ready publication and names its branch", async ({
  page,
}) => {
  const projectId = await project(page, "standalone");
  const token = await createToken(page, projectId);
  const main = await publish(token, projectId, { branch: "main" });

  await open(page, await projectPathFor(page, projectId));
  await expect(page).toHaveURL(new RegExp(`publications/${main.id}$`));
  await expect(page.getByTestId("viewer-publication")).toHaveText("main");
  await expect(page.locator(".fo-top-state")).toContainText("Published");
  const viewer = page.locator("[data-mokly-shell]");
  await expect(viewer).toBeVisible();
  await expect(
    viewer.getByRole("navigation", { name: "Catalogue" }),
  ).toBeVisible();
  await expect(
    viewer.getByRole("heading", { level: 2, name: "Mokly" }),
  ).toBeVisible();
  await expect(
    viewer.getByRole("link", { name: /^Start( Changed)?$/ }),
  ).toBeVisible();
  await expect(
    viewer.getByRole("button", { name: "All", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("a branch alias resolves that branch's newest ready publication", async ({
  page,
}) => {
  const projectId = await project(page, "branches");
  const token = await createToken(page, projectId);
  await publish(token, projectId, { branch: "main" });
  const older = await publish(token, projectId, { branch: "topic" });
  const newer = await publish(token, projectId, { branch: "topic" });

  await open(page, await branchPathFor(page, projectId, "topic"));
  await expect(page).toHaveURL(new RegExp(`publications/${newer.id}$`));
  expect(newer.id).not.toBe(older.id);
  await expect(page.getByTestId("viewer-publication")).toHaveText("topic");
  await publishedViewerReady(page);

  // Switching from the chrome resolves the other branch the same way.
  await page.getByTestId("viewer-publication").click();
  await expect(page.getByTestId("viewer-panel-switcher")).toBeVisible();
  await page
    .getByRole("listitem")
    .filter({ hasText: "main" })
    .getByText("Open")
    .click();
  await expect(page.getByTestId("viewer-publication")).toHaveText("main");
});

test("a pull request alias resolves its publication and can land on Changes", async ({
  page,
}) => {
  const projectId = await project(page, "pulls");
  const token = await createToken(page, projectId);
  fillPullRequest(projectId, pullRequest({ number: 7 }));
  const pull = await publish(token, projectId, {
    branch: "feature",
    pullRequest: 7,
  });

  await open(page, await pullRequestPathFor(page, projectId, 7));
  await expect(page).toHaveURL(new RegExp(`publications/${pull.id}`));

  // The check run's own details link, which always preselects Changes.
  await open(
    page,
    `${await publicationPathFor(page, projectId, pull.id)}?view=changes`,
  );
  await publishedViewerReady(page);
  await expect(
    page
      .locator("[data-mokly-shell]")
      .getByRole("button", { name: /^Changes/ }),
  ).toHaveAttribute("aria-pressed", "true");
  // The Changes badge stands beside the publication pill.
  await expect(
    page.locator('[data-mkc-viewer-slot="switcher"] .fo-top-badge'),
  ).toHaveText("Changes");
});

test("history lists every attempt on this branch, failed ones included", async ({
  page,
}) => {
  const projectId = await project(page, "history");
  const token = await createToken(page, projectId);
  const ready = await publish(token, projectId, { branch: "main" });
  await publish(token, projectId, { branch: "main", corrupt: true });

  await open(page, await publicationPathFor(page, projectId, ready.id));
  await publishedViewerReady(page);
  await page.getByTestId("viewer-history").click();
  const panel = page.getByTestId("viewer-panel-history");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Current publication")).toBeVisible();
  const failed = panel
    .getByRole("listitem")
    .filter({ hasText: "Unable to publish" });
  await expect(failed).toHaveCount(1);
  await failed.getByText("Details").click();
  // A failed attempt opens its own details, never an absent catalogue.
  await expect(page.getByText("Unable to publish this branch")).toBeVisible();
  await expect(
    page.getByText("Ask a project admin to publish again."),
  ).toBeVisible();
});

test("a reference alias carries the whole selection to the publication", async ({
  page,
}) => {
  const projectId = await project(page, "alias-selection");
  const token = await createToken(page, projectId);
  fillPullRequest(projectId, pullRequest({ number: 11 }));
  const branch = await publish(token, projectId, { branch: "main" });
  const pull = await publish(token, projectId, {
    branch: "feature",
    pullRequest: 11,
  });

  // The catalogue screen is the key a resolution is most likely to drop, since
  // the alias's address stops existing on the way to the publication. A
  // component variant is an entry of its own, so it is that screen.
  const selection =
    "catalogueScreen=notice%2Fdraft&viewport=both&scheme=dark" +
    "&search=notice&tag=review&screen=corrupt";
  const branchAlias = await branchPathFor(page, projectId, "main");
  const pullAlias = await pullRequestPathFor(page, projectId, 11);
  for (const [alias, resolved] of [
    [`${branchAlias}&${selection}`, branch.id],
    [`${pullAlias}?${selection}`, pull.id],
  ] as const) {
    await open(page, alias);
    await expect(page).toHaveURL(new RegExp(`publications/${resolved}`));
    const stage = page.locator("[data-mokly-stage]");
    await expect(stage).toHaveAttribute("data-viewport", "both");
    await expect(page.locator("[data-mokly-shell]")).toHaveAttribute(
      "data-mokly-color-scheme",
      "dark",
    );
    await expect(
      page.getByRole("heading", { level: 2, name: "Notice" }),
    ).toBeVisible();
    await expect(
      page.locator('[data-workspace-variant="notice/draft"]'),
    ).toHaveAttribute("aria-current", "page");
    await expectParentUsage(page);
    await expect(page).toHaveURL(/catalogueScreen=notice%2Fdraft/);
    await expect(page).toHaveURL(/viewport=both/);
    await expect(page).toHaveURL(/scheme=dark/);
    await expect(page).toHaveURL(/search=notice/);
    await expect(page).toHaveURL(/tag=review/);
    // The alias carried the reserved key too, so this is a value that had to be
    // dropped rather than one that was never there: `screen` is what React
    // Navigation uses to navigate into a nested navigator, and a resolution is
    // the one place a query the reader supplied crosses into the router.
    await expect(page).not.toHaveURL(/[?&]screen=/);
    // The reference the alias named has been replaced, so its own key goes.
    await expect(page).not.toHaveURL(/branch=/);
  }
});

/**
 * What the router does with the key it reserves, measured rather than assumed.
 *
 * `catalogueScreen` is the canonical name because React Navigation reserves
 * `screen`. This drives a routed navigation from an address that carries the
 * reserved key and asserts the path it rebuilds, so the property the protocol
 * states is the property the suite checks — whichever way the router behaves.
 */
test("a routed move from a screen-bearing address keeps its path", async ({
  page,
}) => {
  const projectId = await project(page, "reserved-key");
  const token = await createToken(page, projectId);
  const main = await publish(token, projectId, { branch: "main" });
  await publish(token, projectId, { branch: "topic" });

  await open(
    page,
    `${await publicationPathFor(page, projectId, main.id)}?screen=corrupt`,
  );
  await publishedViewerReady(page);
  // A router navigation out of that address: the switcher follows a reference,
  // which is a push rather than a query write.
  await page.getByTestId("viewer-publication").click();
  await page
    .getByRole("listitem")
    .filter({ hasText: "topic" })
    .getByText("Open")
    .click();
  await expect(page.getByTestId("viewer-publication")).toHaveText("topic");
  // The path names the page, with nothing of the reserved key's value in it.
  const path = new URL(page.url()).pathname;
  expect(path, "the rebuilt path carries no navigator segment").not.toContain(
    "corrupt",
  );
  const projectRoute = await projectPathFor(page, projectId);
  expect(path).toMatch(new RegExp(`^${projectRoute}/(publications|branches)`));
});

test("a reference alias carries the settings pane its link named", async ({
  page,
}) => {
  const projectId = await project(page, "alias-settings");
  const token = await createToken(page, projectId);
  const branch = await publish(token, projectId, { branch: "main" });

  // A reader who opens a shared link with the account dialog named expects the
  // dialog, and the resolution is a router navigation, which is the one move
  // that could start the publication address with a query of its own.
  await open(
    page,
    `${await branchPathFor(page, projectId, "main")}&settings=account`,
  );
  await expect(page).toHaveURL(new RegExp(`publications/${branch.id}`));
  await expect(page).toHaveURL(/settings=account/);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { level: 1 })).toHaveText("Account");
});

test("every reference row reads its own newest attempt, not the project's", async ({
  page,
}) => {
  const projectId = await project(page, "refstate");
  const token = await createToken(page, projectId);
  // The pull request itself is a provider observation, which is how one
  // reaches Mokly; the publication that names it is published for real.
  fillPullRequest(projectId, {
    number: 3,
    title: "Publish the viewer",
    author: "octocat",
    branch: "feature",
  });
  await publish(token, projectId, { branch: "feature", pullRequest: 3 });
  await publish(token, projectId, {
    branch: "feature",
    pullRequest: 3,
    corrupt: true,
  });
  const other = await publish(token, projectId, { branch: "main" });
  // More than one page of history on another reference, so a read that asked
  // the project rather than the reference would never see this row's own
  // newest attempt.
  fillHistory(projectId, "noise", 60);

  await open(page, await publicationPathFor(page, projectId, other.id));
  await publishedViewerReady(page);
  await page.getByTestId("viewer-publication").click();
  const panel = page.getByTestId("viewer-panel-switcher");
  await expect(panel).toBeVisible();
  // The newest attempt on that reference failed, and the row says so rather
  // than reporting whatever the project published most recently.
  await expect(
    panel.getByRole("listitem").filter({ hasText: "feature" }).first(),
  ).toContainText("Unable to publish");
  // The pull request is its own reference, with its own newest attempt: it
  // reads a state, not merely "ready" or "none".
  await expect(
    panel.locator(".fo-group-label", { hasText: "Pull requests" }),
  ).toBeVisible();
  const pull = panel
    .getByRole("listitem")
    .filter({ hasText: "#3 Publish the viewer" });
  await expect(pull).toHaveCount(1);
  await expect(pull).toContainText("octocat");
  await expect(pull).toContainText("Unable to publish");
});
