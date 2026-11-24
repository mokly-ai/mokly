import type { Locator, Page } from "@playwright/test";

import { publicationPathFor } from "../addresses";
import { fillPullRequest, installedRepository } from "../database-fixture";
import { expect, freshEmail, open, signIn, test } from "../harness";
import { createProject } from "../project-setup";
import { createToken, publish } from "../publish";
import type { PublishInput } from "../publish";

import { publishedViewerReady } from "./support";

/**
 * The Mokly check in the package's Changes tab. A pull request's publication
 * with a comparison shows the check card after the change stepper and before
 * Compared, and a branch's publication shows none. The contract fixture's
 * index counts seven changed entries and none added or removed, and its Start
 * screen is one of the changed entries.
 */

/** The stepper's count, which the Changes tab of a changed entry starts with. */
const stepperCount = /^Change \d+ of \d+$/;

/**
 * Publish the fixture to a new reader's project, open its Start screen in
 * Changes, and select the right panel's Changes tab, as a reader does after a
 * check link. The stepper and Compared show that the tab has loaded.
 */
async function changesTab(
  page: Page,
  label: string,
  input: PublishInput,
  pull?: { number: number; title: string },
): Promise<Locator> {
  await signIn(page, freshEmail(label));
  const projectId = await createProject(page, label + " Org");
  const token = await createToken(page, projectId);
  if (pull)
    fillPullRequest(projectId, {
      ...pull,
      author: "octocat",
      branch: "feature",
    });
  const published = await publish(token, projectId, input);
  const path = await publicationPathFor(page, projectId, published.id);
  await open(page, `${path}?view=changes&catalogueScreen=start`);
  await publishedViewerReady(page);
  await page.getByRole("tab", { name: "Changes", exact: true }).click();
  const tab = page.getByRole("tabpanel", { name: "Changes", exact: true });
  await expect(tab.getByText(stepperCount)).toBeVisible();
  await expect(
    tab.getByRole("heading", { name: "Compared", exact: true }),
  ).toBeVisible();
  return tab;
}

/** The bottom edge, and the top edge, of a shown element, in page pixels. */
async function edges(
  locator: Locator,
): Promise<{ top: number; bottom: number }> {
  const box = await locator.boundingBox();
  expect(box, "the element has a box").not.toBeNull();
  return { top: box?.y ?? 0, bottom: (box?.y ?? 0) + (box?.height ?? 0) };
}

test("a pull request's publication with a comparison shows the Mokly check in the Changes tab", async ({
  page,
}) => {
  const tab = await changesTab(
    page,
    "changes-check",
    { branch: "feature", pullRequest: 42 },
    { number: 42, title: "Name the pull request" },
  );
  const name = tab.getByText("Mokly", { exact: true });
  await expect(name).toBeVisible();
  await expect(
    tab.getByText("7 changed, 0 added, 0 removed.", { exact: true }),
  ).toBeVisible();
  // The card's one way on is the pull request's checks on GitHub.
  const checks = tab.getByRole("link", {
    name: "#42 · Name the pull request",
    exact: true,
  });
  await expect(checks).toHaveAttribute(
    "href",
    `https://github.com/${installedRepository}/pull/42/checks`,
  );
  // The card stands after the change stepper and before Compared.
  const stepper = await edges(tab.getByText(stepperCount));
  const compared = await edges(
    tab.getByRole("heading", { name: "Compared", exact: true }),
  );
  expect(stepper.bottom).toBeLessThanOrEqual((await edges(name)).top);
  expect((await edges(checks)).bottom).toBeLessThanOrEqual(compared.top);
});

test("a branch's publication shows no check in the Changes tab", async ({
  page,
}) => {
  const tab = await changesTab(page, "changes-no-check", { branch: "main" });
  await expect(tab.getByText("Mokly", { exact: true })).toHaveCount(0);
  await expect(tab.getByRole("link", { name: /^#\d+ · / })).toHaveCount(0);
});
