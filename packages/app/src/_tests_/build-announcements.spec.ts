import { installPollClock, nextPoll } from "./build-clock";
import { focusOutline, tokenOutline } from "./build-refusals";
import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import { build, buildId } from "./viewer/build-fixtures";

/**
 * What a build card says to a reader who cannot see it change: where the
 * reader lands after Cancel, and that a late read does not undo it. The title
 * and the line a failure announces are the failed row of the shared build
 * state table in `build-states.spec.ts`.
 */

test("Cancel from the keyboard leaves the reader on the new title", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  const scenario = await buildScenario(page, "build-cancel-keys");
  const { double, projectId } = scenario;
  const id = buildId(31);
  double.builds.set(
    id,
    build({ id, projectId, state: "queued", step: null, startedAt: null }),
  );
  await open(page, scenario.buildAt(id));
  const cancel = page.getByTestId("build-cancel");
  await cancel.focus();
  await page.keyboard.press("Enter");
  const title = page.getByRole("heading", { name: "Publishing was cancelled" });
  await expect(title).toBeFocused();
  // The title draws the token focus outline around its own words, in place
  // of the browser's ring.
  expect(await title.evaluate(focusOutline)).toEqual(tokenOutline("light"));
  await expect(page.locator(".fo-build").getByRole("status")).toHaveText(
    "Publishing was cancelled",
  );
  // The next Tab reaches the card's way on, which follows the title.
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("build-try-again")).toBeFocused();
});

test("a read that answers after Cancel leaves the card, its status and focus in step", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-late-read");
  const { double, projectId } = scenario;
  const id = buildId(33);
  double.builds.set(id, build({ id, projectId }));
  await installPollClock(page);
  await open(page, scenario.buildAt(id));
  const card = page.locator(".fo-build");
  await expect(
    card.getByRole("heading", { name: "Publishing this branch" }),
  ).toBeVisible();

  // The next poll's build read waits, holding the build as it was then.
  let release = () => {};
  double.holdBuildReads = new Promise((resolve) => {
    release = resolve;
  });
  await nextPoll(page);
  await expect.poll(() => double.heldBuildReads).toBe(1);
  await page.getByTestId("build-cancel").focus();
  await page.keyboard.press("Enter");
  const title = card.getByRole("heading", { name: "Publishing was cancelled" });
  await expect(title).toBeFocused();
  await expect(card.getByRole("status")).toHaveText("Publishing was cancelled");

  // Record every title and status the card shows from here on.
  await card.evaluate((node) => {
    const seen: string[] = [];
    Object.assign(window, { seenBuildCard: seen });
    new MutationObserver(() => {
      const title = node.querySelector(".fo-state-title")?.textContent ?? "";
      const status = node.querySelector("[role=status]")?.textContent ?? "";
      seen.push(title + " | " + status);
    }).observe(node, { subtree: true, childList: true, characterData: true });
  });

  // The held read answers that the build still runs. It started before
  // Cancel's answer, so the card drops it and stays in step with its status.
  double.holdBuildReads = undefined;
  release();
  await expect.poll(() => double.heldBuildReads).toBe(0);
  // The card starts a poll only once the one before it has settled, held
  // read included, so a build read that a later poll starts proves the card
  // has taken the held answer. The log is not whole yet, so the card still
  // polls; each look lets one more poll interval pass on the page.
  const taken = double.reads.length;
  await expect
    .poll(async () => {
      await nextPoll(page);
      return double.reads.slice(taken).includes("build:" + id);
    })
    .toBe(true);
  const seen = await page.evaluate(
    () => (window as unknown as { seenBuildCard: string[] }).seenBuildCard,
  );
  expect(
    seen.filter(
      (shown) =>
        shown !== "Publishing was cancelled | Publishing was cancelled",
    ),
  ).toEqual([]);
  await expect(title).toBeFocused();
  await expect(card.getByRole("status")).toHaveText("Publishing was cancelled");
  await expect(page.getByTestId("build-cancel")).toHaveCount(0);
  expect(double.cancels).toEqual([id]);
});
