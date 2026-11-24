import { publicationPathFor } from "../addresses";
import { fillPullRequest, installedRepository } from "../database-fixture";
import { expect, freshEmail, open, signIn, test } from "../harness";
import { createProject } from "../project-setup";
import { createToken, publish } from "../publish";

import { publicationReference } from "./support";

/**
 * A publication address names the pull request that produced it, whatever the
 * address said on the way in.
 *
 * The check run links straight to `/publications/<id>`, and a reference alias is
 * replaced by that same address the moment it resolves, so neither carries the
 * pull request's number. The publication carries its own observation, which is
 * what lets an immutable link say which review it belongs to.
 */
test("a publication address names its pull request and links to GitHub", async ({
  page,
}) => {
  await signIn(page, freshEmail("pr-identity"));
  const projectId = await createProject(page, "PR Identity Org");
  const token = await createToken(page, projectId);
  fillPullRequest(projectId, {
    number: 42,
    title: "Name the pull request",
    author: "octocat",
    branch: "feature",
  });
  const published = await publish(token, projectId, {
    branch: "feature",
    pullRequest: 42,
  });

  // The check run's own details link: a publication address and nothing else.
  await open(
    page,
    `${await publicationPathFor(page, projectId, published.id)}?view=changes`,
  );
  await expect(publicationReference(page)).toHaveText(
    "#42 Name the pull request",
  );
  const state = page.locator(".fo-top-state");
  await expect(state).toContainText("octocat");
  // The pull request on GitHub stands beside the publication pill.
  const github = page
    .locator('[data-mkc-viewer-slot="switcher"]')
    .getByRole("link", { name: "GitHub" });
  await expect(github).toHaveAttribute(
    "href",
    `https://github.com/${installedRepository}/pull/42`,
  );
});

/** An observation with no author says the publication, and nothing in its place. */
test("a pull request without an observed author names no author", async ({
  page,
}) => {
  await signIn(page, freshEmail("pr-anonymous"));
  const projectId = await createProject(page, "PR Anonymous Org");
  const token = await createToken(page, projectId);
  fillPullRequest(projectId, {
    number: 8,
    title: "Retain the author login",
    author: null,
    branch: "older",
  });
  const published = await publish(token, projectId, {
    branch: "older",
    pullRequest: 8,
  });

  await open(page, await publicationPathFor(page, projectId, published.id));
  await expect(publicationReference(page)).toHaveText(
    "#8 Retain the author login",
  );
  const detail = page.locator(".fo-top-state-detail");
  // An author would lead the phrase, attached by a separator of its own. The
  // phrase leading with only its own separator says nothing was put where the
  // author is not known.
  await expect(detail).toHaveText(/^Ready · [^·]+$/);
});
