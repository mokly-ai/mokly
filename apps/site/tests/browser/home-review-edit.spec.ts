import { type Locator, type Page, expect, test } from "@playwright/test";

import { SITE_PATHS } from "../../src/navigation.js";

/**
 * The Review and Edit modules of the home, as docs/protocol/cloud/site-copy.md
 * and site-design-pages.md fix them: each frame is a depiction that leaves
 * only the module's copy to assistive technology, and each demo plays once
 * when it comes into view and rests in the finished state that the built
 * page draws. The island's own decisions are in tests/home_island.test.ts.
 *
 * A demo's start and finished states differ in opacity, clip and transform,
 * which Playwright's visibility check does not read, so the motion cases
 * read those computed values on the depicted parts, which have no role.
 */

/** The copy of each module, which the page sets as its own text. */
const MODULES = [
  {
    body: "Each comment is tied to the component it is about, so it stays put when the layout changes. Approve when it is right, in step with the pull request review.",
    kicker: "02 Review",
    title: "Sticky comments.",
  },
  {
    body: "An agent edits the mockup source in a live branch session. Click an element to bring it into the conversation, then publish back to the branch.",
    kicker: "03 Edit",
    title: "Ask for the change beside the screen.",
  },
] as const;

/** Every element that can take focus. */
const FOCUSABLE =
  "a[href], area[href], button, input, select, textarea, iframe, summary, [tabindex], [contenteditable]";

/**
 * A transform that moves nothing: the base `none`, or the identity matrix
 * that an ended animation leaves.
 */
const AT_REST = /^(?:none|matrix\(1, 0, 0, 1, 0, 0\))$/;

/** A demo runs a few seconds; its finished state waits at most this long. */
const PLAY = { timeout: 15_000 };

/** The parts of the Review demo that show its start and its end. */
function reviewParts(page: Page): { cursor: Locator; last: Locator } {
  const review = page.getByRole("article", { name: "Sticky comments." });
  return {
    cursor: review.locator(".site-home-review-maya"),
    last: review
      .locator(".site-home-message")
      .filter({ hasText: "Agreed. Let’s ask Claude for 24." }),
  };
}

/** The parts of the Edit demo that show its start and its end. */
function editParts(
  page: Page,
): Record<"after" | "answer" | "before" | "publish", Locator> {
  const edit = page.getByRole("article", {
    name: "Ask for the change beside the screen.",
  });
  return {
    after: edit.locator(".site-home-edit-layer--after"),
    answer: edit.locator(".site-agent-turn").filter({
      hasText: "Done. The PriceCard now has padding 24 and the Primary button.",
    }),
    before: edit.locator(".site-home-edit-layer--before"),
    publish: edit.getByText("Publish to feat/checkout-v2"),
  };
}

/** The thread waits for Approve: both messages shown, Maya's cursor still. */
async function expectReviewFinished(page: Page): Promise<void> {
  const { cursor, last } = reviewParts(page);
  await expect(last).toHaveCSS("opacity", "1", PLAY);
  await expect(cursor).toHaveCSS("transform", AT_REST, PLAY);
  await expect(cursor).toHaveCSS("opacity", "1");
}

/** The agent's change is on the artboard, every message shown, Publish ready. */
async function expectEditFinished(page: Page): Promise<void> {
  const { after, answer, before, publish } = editParts(page);
  await expect(publish).toHaveCSS("opacity", "1", PLAY);
  await expect(answer).toHaveCSS("opacity", "1");
  await expect(after).toHaveCSS("clip-path", "inset(0px 0px 0%)");
  await expect(before).toHaveCSS("opacity", "0");
}

test("the Review and Edit frames leave only the module's copy to assistive technology", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.home);
  for (const { body, kicker, title } of MODULES) {
    const module = page.getByRole("article", { name: title });
    await expect(module, title).toMatchAriaSnapshot(`
      - /children: equal
      - paragraph: ${kicker}
      - heading "${title}" [level=3]
      - paragraph: ${body}
    `);
    await expect(module.getByRole("heading", { name: title })).toBeVisible();
    await expect(module.getByText(body)).toBeVisible();
    await expect(module.locator(FOCUSABLE), title).toHaveCount(0);
  }
});

test.describe("with motion allowed", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("the Review demo plays once in view and rests waiting for Approve", async ({
    page,
  }) => {
    await page.goto(SITE_PATHS.home);
    const { cursor, last } = reviewParts(page);
    await expect(last).toHaveCSS("opacity", "0");
    await expect(cursor).toHaveCSS("opacity", "0");

    await page
      .getByRole("article", { name: "Sticky comments." })
      .scrollIntoViewIfNeeded();
    await expectReviewFinished(page);
  });

  test("the Edit session plays once in view and rests with Publish ready", async ({
    page,
  }) => {
    await page.goto(SITE_PATHS.home);
    const { after, answer, before, publish } = editParts(page);
    await expect(answer).toHaveCSS("opacity", "0");
    await expect(publish).toHaveCSS("opacity", "0.5");
    await expect(after).toHaveCSS("clip-path", "inset(0px 0px 100%)");
    await expect(before).toHaveCSS("opacity", "1");

    await page
      .getByRole("article", { name: "Ask for the change beside the screen." })
      .scrollIntoViewIfNeeded();
    await expectEditFinished(page);
  });
});

test.describe("under reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("the Review and Edit demos rest in their finished states at once", async ({
    page,
  }) => {
    await page.goto(SITE_PATHS.home);
    await expectReviewFinished(page);
    await expectEditFinished(page);

    await page
      .getByRole("article", { name: "Ask for the change beside the screen." })
      .scrollIntoViewIfNeeded();
    await expectReviewFinished(page);
    await expectEditFinished(page);
  });
});
