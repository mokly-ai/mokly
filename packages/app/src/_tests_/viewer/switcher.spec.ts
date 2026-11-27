import type { Page } from "@playwright/test";

import { defaultPageSize, referencePageLimit } from "../../data/publications";
import { publicationPathFor } from "../addresses";
import { fillBranches, fillHistory } from "../database-fixture";
import { expect, freshEmail, open, signIn, test } from "../harness";
import { createProject } from "../project-setup";
import { createToken, publish } from "../publish";

import { publicationReference, publishedViewerReady } from "./support";

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
 * The switcher asks the two reference lists and nothing else, leads with its
 * search, and marks the reader's reference Current.
 *
 * Each row's state, time and head come from the row itself, so nothing here is
 * read per reference: eight references on one page of each list are two reads
 * rather than two plus eight. What scales is pages, which the cap spec
 * covers. The history count is what holds the property: a panel that went back
 * to asking each reference for its own newest attempt would raise it whatever
 * the list requests did.
 *
 * The switcher's own composition in `folio-viewer.md`: the reference the
 * reader is on says Current and is no link, every other row is a link over
 * its whole frame, and the search leads the panel in its bar, before Close,
 * while the title stays the document's one heading for assistive technology.
 */
test("opening the switcher reads no reference's own history, and it leads with its search and marks the reader's reference Current", async ({
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

  const panel = page.getByTestId("viewer-panel-switcher");

  await test.step("opening the switcher reads no reference's own history", async () => {
    await open(page, await publicationPathFor(page, projectId, here.id));
    await publishedViewerReady(page);
    expect(branches(), "a publication address reads no reference list").toBe(0);

    await page.getByTestId("viewer-publication").click();
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("listitem")).toHaveCount(8);
    expect(branches(), "one page of branches").toBe(1);
    expect(pulls(), "one page of pull requests").toBe(1);
    expect(history(), "no reference is asked for its own history").toBe(0);
  });

  await test.step("the switcher leads with its search and marks the reader's reference Current", async () => {
    const row = (name: string) =>
      panel.getByRole("listitem").filter({ hasText: name });
    await expect(row("topic-1").getByRole("link")).toBeVisible();
    await expect(row("main")).toContainText("Current");
    await expect(row("main").getByRole("link")).toHaveCount(0);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Branches and pull requests",
    );
    await panel.getByLabel("Find a branch or pull request").focus();
    await page.keyboard.press("Tab");
    await expect(panel.getByTestId("close-switcher")).toBeFocused();

    // The whole row is the link: the pointer in the row's own padding, outside
    // the link's content, shows the text at 5% over the row, and a press there
    // follows the link. The reader's current row keeps its own fill.
    const current = row("main");
    const currentFill = await current.evaluate(
      (node) => getComputedStyle(node).backgroundColor,
    );
    await current.hover({ position: { x: 4, y: 8 } });
    await expect(current).toHaveCSS("background-color", currentFill);
    const topic = row("topic-1");
    const box = await topic.boundingBox();
    expect(box).not.toBeNull();
    const padding = { x: 4, y: (box?.height ?? 0) / 2 };
    await topic.hover({ position: padding });
    await expect(topic).toHaveCSS(
      "background-color",
      "color(srgb 0.0509804 0.0784314 0.0627451 / 0.05)",
    );
    await topic.click({ position: padding });
    await expect(publicationReference(page)).toHaveText("topic-1");
  });
});

/**
 * Past the cap the panel says so, where the reader is already looking, and a
 * row past the first page says what its own newest attempt did.
 *
 * A list that stopped early looks exactly like a complete one, so this plants
 * one more reference than the read can reach: the last name is genuinely absent
 * from the panel, and the notice is what tells the reader that absence is the
 * read's bound rather than the repository's contents. It sits above the rows
 * because at the foot of a thousand of them it was some sixty-five thousand
 * pixels below the search field, which is not somewhere a reader finds it.
 */
test("a read that stops at its cap says so, above the rows, and a row past the first page says what its newest attempt did", async ({
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
  // A real failed attempt, newer than the seeded row on that branch, on a
  // reference the first page does not contain.
  await publish(token, projectId, { branch: "topic-0060", corrupt: true });

  await open(page, await publicationPathFor(page, projectId, here.id));
  await publishedViewerReady(page);
  await page.getByTestId("viewer-publication").click();
  const panel = page.getByTestId("viewer-panel-switcher");
  await expect(panel).toBeVisible();

  await test.step("a row past the first page says what its own newest attempt did", async () => {
    const beyond = panel
      .getByRole("listitem")
      .filter({ hasText: "topic-0050" });
    await expect(beyond).toHaveCount(1);
    await expect(beyond).toContainText("Published");
    const failed = panel
      .getByRole("listitem")
      .filter({ hasText: "topic-0060" });
    await expect(failed).toContainText("Unable to publish");
  });

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
