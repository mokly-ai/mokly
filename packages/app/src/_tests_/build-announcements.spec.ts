import { focusOutline, tokenOutline } from "./build-refusals";
import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import { build, buildId } from "./viewer/build-fixtures";

/**
 * What a build card says to a reader who cannot see it change: the title and
 * the line a failure announces, and where the reader lands after Cancel.
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

test("a failure announces only its title and line", async ({ page }) => {
  const scenario = await buildScenario(page, "build-alert");
  const { double, projectId } = scenario;
  const id = buildId(32);
  double.builds.set(
    id,
    build({
      id,
      projectId,
      state: "failed",
      canCancel: false,
      failure: { step: "install", cause: "exit", exitCode: 1 },
    }),
  );
  await open(page, scenario.buildAt(id));
  const card = page.locator(".fo-build");
  const alert = card.getByRole("alert");
  await expect(alert).toHaveCount(1);
  await expect(alert.locator(":scope > *")).toHaveText([
    "Unable to publish this branch",
    "Installing dependencies failed.",
  ]);
  await expect(
    alert.locator(".fo-build-reference, a, button, [role=button]"),
  ).toHaveCount(0);
  await expect(card.locator(".fo-build-reference")).toContainText("topic");

  // The reference reads after the message and still sits between the title
  // and the line on screen, one space step from each.
  const layout = await card.locator(".fo-build-summary").evaluate((summary) => {
    const box = (selector: string) =>
      summary.querySelector(selector)?.getBoundingClientRect();
    const title = box(".fo-state-title");
    const reference = box(".fo-build-reference");
    const line = box(".fo-build-line");
    if (!title || !reference || !line) return ["missing a row"];
    const step =
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize) *
      0.25;
    const near = (a: number, b: number) => Math.abs(a - b) <= 1;
    const problems: string[] = [];
    if (!near(reference.top - title.bottom, step))
      problems.push("reference is not one step below the title");
    if (!near(line.top - reference.bottom, step))
      problems.push("line is not one step below the reference");
    if (!near(reference.left, title.left) || !near(line.left, title.left))
      problems.push("rows are not aligned");
    return problems;
  });
  expect(layout).toEqual([]);

  // A refused Try again is announced beside its control, and the message's
  // alert keeps only the title and the line.
  double.refuseRequest = { reason: "builds-unavailable" };
  await page.getByTestId("build-try-again").click();
  await expect(card.locator(".fo-write-failure [role=alert]")).toHaveText(
    "This project publishes from CI.",
  );
  await expect(card.locator(".fo-build-message")).toHaveAttribute(
    "role",
    "alert",
  );
  await expect(card.locator(".fo-build-message > *")).toHaveText([
    "Unable to publish this branch",
    "Installing dependencies failed.",
  ]);
});

test("a read that answers after Cancel leaves the card, its status and focus in step", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-late-read");
  const { double, projectId } = scenario;
  const id = buildId(33);
  double.builds.set(id, build({ id, projectId }));
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
  await page.waitForTimeout(1_000);
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
