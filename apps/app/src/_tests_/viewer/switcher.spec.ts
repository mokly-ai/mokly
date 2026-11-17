import type { Page } from "@playwright/test";

import {
  createProject,
  expect,
  freshEmail,
  open,
  publicationPathFor,
  signIn,
  test,
} from "../harness";
import { createToken, publish } from "../publish";
import { fillBranches, fillHistory } from "../database-fixture";
import { defaultPageSize, referencePageLimit } from "../../data/publications";
import { publishedViewerReady } from "./support";

/** Count every request to one address, without holding it open. */
async function counted(page: Page, url: string): Promise<() => number> {
  let seen = 0;
  await page.route(url, (route) => {
    seen += 1;
    return route.continue();
  });
  return () => seen;
}

/**
 * The switcher asks the two reference lists and nothing else.
 *
 * Each row's state, time and head come from the row itself, so nothing here is
 * read per reference: eight references on one page of each list are two reads
 * rather than two plus eight. What scales is pages, which the second spec
 * covers. The history count is what holds the property: a panel that went back
 * to asking each reference for its own newest attempt would raise it whatever
 * the list requests did.
 */
test("opening the switcher reads no reference's own history", async ({
  page,
}) => {
  await signIn(page, freshEmail("switcher-reads"));
  const projectId = await createProject(page, "Switcher Reads Org");
  const token = await createToken(page, projectId);
  const here = await publish(token, projectId, { branch: "main" });
  for (let index = 1; index <= 7; index += 1) {
    fillHistory(projectId, `topic-${index}`, 1, index + 100);
  }

  const branches = await counted(page, "**/v1/projects/*/branches*");
  const pulls = await counted(page, "**/v1/projects/*/pull-requests*");
  const history = await counted(page, "**/v1/projects/*/publications?*");

  await open(page, await publicationPathFor(page, projectId, here.id));
  await publishedViewerReady(page);
  expect(branches(), "a publication address reads no reference list").toBe(0);

  await page.getByTestId("viewer-publication").click();
  const panel = page.getByTestId("viewer-panel-switcher");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("listitem")).toHaveCount(8);
  expect(branches(), "one page of branches").toBe(1);
  expect(pulls(), "one page of pull requests").toBe(1);
  expect(history(), "no reference is asked for its own history").toBe(0);
});

/**
 * A repository with more branches than one page shows every one of them, and a
 * row past the first page says what its own newest attempt did.
 */
test("the switcher follows the cursor past the first page", async ({
  page,
}) => {
  await signIn(page, freshEmail("switcher-pages"));
  const projectId = await createProject(page, "Switcher Pages Org");
  const token = await createToken(page, projectId);
  const here = await publish(token, projectId, { branch: "main" });
  // Sixty-one references in all: one page is fifty, so `topic-050` onwards are
  // only reachable by following the cursor.
  fillBranches(projectId, "topic-", 60);
  // A real failed attempt, newer than the seeded row on that branch, on a
  // reference the first page does not contain.
  await publish(token, projectId, { branch: "topic-060", corrupt: true });

  await open(page, await publicationPathFor(page, projectId, here.id));
  await publishedViewerReady(page);
  await page.getByTestId("viewer-publication").click();
  const panel = page.getByTestId("viewer-panel-switcher");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("listitem")).toHaveCount(61);

  const beyond = panel.getByRole("listitem").filter({ hasText: "topic-050" });
  await expect(beyond).toHaveCount(1);
  await expect(beyond).toContainText("Published");
  const failed = panel.getByRole("listitem").filter({ hasText: "topic-060" });
  await expect(failed).toContainText("Unable to publish");
});

/**
 * Past the cap the panel says so, where the reader is already looking.
 *
 * A list that stopped early looks exactly like a complete one, so this plants
 * one more reference than the read can reach: the last name is genuinely absent
 * from the panel, and the notice is what tells the reader that absence is the
 * read's bound rather than the repository's contents. It sits above the rows
 * because at the foot of a thousand of them it was some sixty-five thousand
 * pixels below the search field, which is not somewhere a reader finds it.
 */
test("a read that stops at its cap says so, above the rows", async ({
  page,
}) => {
  await signIn(page, freshEmail("switcher-cap"));
  const projectId = await createProject(page, "Switcher Cap Org");
  const token = await createToken(page, projectId);
  const here = await publish(token, projectId, { branch: "main" });
  const cap = referencePageLimit * defaultPageSize;
  // `main` plus the cap, so the last page of the walk ends with a cursor in
  // hand and the reference beyond it is never read.
  fillBranches(projectId, "topic-", cap, 1, 4);

  await open(page, await publicationPathFor(page, projectId, here.id));
  await publishedViewerReady(page);
  await page.getByTestId("viewer-publication").click();
  const panel = page.getByTestId("viewer-panel-switcher");
  await expect(panel).toBeVisible();
  const notice = panel.getByTestId("switcher-more-references");
  await expect(notice).toBeVisible();
  // Formatted in the page, so the assertion and the component agree about the
  // locale rather than agreeing only while both default to English.
  const counted = await page.evaluate((rows) => rows.toLocaleString(), cap);
  await expect(notice).toContainText(counted);
  // Above the rows in document order, which is what `toBeVisible` cannot say:
  // it scrolls its target into view, so it passes wherever the notice sits.
  const order = await page.evaluate(() => {
    const open = document.querySelector(
      '[data-testid="viewer-panel-switcher"]',
    );
    const notice = open?.querySelector(
      '[data-testid="switcher-more-references"]',
    );
    const row = open?.querySelector("li");
    if (!notice || !row) return "missing";
    const follows =
      notice.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING;
    return follows ? "notice first" : "row first";
  });
  expect(order, "the notice is above the rows").toBe("notice first");
  // And the reference the read never reached is genuinely absent, so the
  // notice reports a real bound rather than decorating a complete list.
  await expect(
    panel.getByRole("listitem").filter({ hasText: "topic-1000" }),
  ).toHaveCount(0);

  // A search that finds nothing while the read is capped says the one true
  // thing, once. Two cards — "clear the search to see every branch" above
  // "this list shows the first thousand" — disagree with each other, and the
  // first is false whenever the second is shown.
  await page.getByLabel("Find a branch or pull request").fill("topic-1000");
  const cards = panel.locator(".fo-state");
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText("This list shows the first");
  await expect(cards).not.toContainText("Clear the search");
});
