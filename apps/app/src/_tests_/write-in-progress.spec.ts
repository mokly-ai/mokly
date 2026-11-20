import type { Page } from "@playwright/test";

import { githubFlowKeys } from "../navigation/github-flow";

import { countRequests } from "./api-responses";
import { connection, githubState, json, storedFlow } from "./auth-callbacks";
import { releaseRecordedGitHub } from "./database-fixture";
import { answerGitHubPages } from "./github-installation";
import { expect, freshEmail, open, signIn, test } from "./harness";
import { githubOrigin } from "./origins";

/**
 * A write that leaves the page, as Write in progress in `folio-chrome.md`
 * defines it: the pressed control carries the wait until the page has gone,
 * the page leaves only from the screen that started the write, and a page the
 * browser restores is at rest.
 *
 * The browser defers every read of a page whose navigation is still pending,
 * so a page that is leaving cannot be read. These tests answer a trip to
 * GitHub with 204 No Content, which ends that navigation and keeps the page
 * exactly as it was while it left.
 */

/** Where the GitHub sign-in in these tests leaves for. */
const signInTrip = `${githubOrigin}/login/oauth/authorize?state=${githubState}`;

/** Press one control twice in a single task, before anything can disable it. */
async function pressTwice(page: Page, control: string): Promise<void> {
  await page.getByTestId(control).evaluate((node: HTMLElement) => {
    node.click();
    node.click();
  });
}

/**
 * Answer the start of a GitHub sign-in with a trip to `signInTrip`, as the
 * callback specs answer it, so a repeated walk sends no GitHub flow start to
 * the API, whose admission window would refuse it. `held` holds the answer.
 * Returns how many starts were sent.
 */
async function answerSignInStart(
  page: Page,
  held: Promise<void> = Promise.resolve(),
): Promise<() => number> {
  let starts = 0;
  await page.route("**/v1/auth/github", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    starts += 1;
    await held;
    return json(route, connection(signInTrip));
  });
  return () => starts;
}

/**
 * Answer each trip to GitHub with 204 No Content, and list the address of
 * each, in order. The first `stopped` trips are answered so; later ones go on
 * to the routes registered before this one.
 */
async function stopTrips(
  page: Page,
  url: string,
  stopped = Number.POSITIVE_INFINITY,
): Promise<string[]> {
  const trips: string[] = [];
  await page.route(url, (route) => {
    if (trips.length >= stopped) return route.fallback();
    trips.push(route.request().url());
    return route.fulfill({ status: 204 });
  });
  return trips;
}

test("Install on GitHub stays busy until the page leaves and installs once", async ({
  page,
}) => {
  await signIn(page, freshEmail("one-authorization"));
  await page.waitForURL((url) => url.pathname === "/new");
  await page.getByLabel("Workspace name").fill("Once Org");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL(/\/install/);

  // The control has to refuse the second press itself rather than rely on
  // being greyed out: both presses land before anything is re-rendered.
  releaseRecordedGitHub();
  await answerGitHubPages(page);
  const installations = await countRequests(
    page,
    "**/v1/github/installations",
    "POST",
  );
  const trips = await stopTrips(
    page,
    `${githubOrigin}/apps/*/installations/new*`,
    1,
  );
  await pressTwice(page, "install-app");

  // The pressed control carries the wait, and the step keeps its form.
  const control = page.getByTestId("install-app");
  await expect(control, "the working word").toHaveText("Installing…");
  await expect(control, "the busy spinner").toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(control, "a busy control stays enabled").toBeEnabled();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Installing the Mokly app…",
  );
  await expect(page.getByRole("link", { name: "Back" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Publish with the CLI instead" }),
  ).toBeVisible();

  // The write is done when the page leaves, so while the page leaves the
  // control stays busy, and a press sends nothing.
  await expect.poll(() => trips.length).toBe(1);
  await expect(control, "busy until the page leaves").toHaveText("Installing…");
  await expect(control).toHaveAttribute("aria-busy", "true");
  await control.click();
  // The trip the 204 stopped, made now.
  await page.goto(trips[0]);
  await page.waitForURL((url) => /^\/[^/]+\/-\/new$/.test(url.pathname));
  expect(installations(), "installing sends one request").toBe(1);
  await page.unrouteAll();
});

test("a GitHub trip leaves only from the screen that started it", async ({
  page,
}) => {
  await open(page, "/sign-in");
  let answer = () => {};
  const held = new Promise<void>((done) => (answer = done));
  await answerSignInStart(page, held);
  await stopTrips(page, `${githubOrigin}/**`);
  const control = page.getByTestId("github-entry");
  await control.click();
  await expect(control).toHaveText("Connecting…");

  // The reader follows another link while the start is answered.
  await page.getByRole("link", { name: "Create an account" }).click();
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText("Create your account");
  // The page's own navigate event fires as a trip starts, before any next
  // page loads, so this record does not depend on when that page arrives.
  await page.evaluate(() => {
    navigation.addEventListener("navigate", (event) => {
      if (new URL(event.destination.url).origin !== window.location.origin)
        document.documentElement.dataset.trip = event.destination.url;
    });
  });
  answer();
  // The flow is stored just before the trip would start, so once it is
  // stored, the write has decided whether to leave.
  await expect
    .poll(() => storedFlow(page, githubFlowKeys["sign-in"]))
    .not.toBeNull();
  const trip = await page.evaluate(
    () => document.documentElement.dataset.trip ?? null,
  );
  expect(trip, "the reader stays where they went").toBeNull();
  await expect(heading).toHaveText("Create your account");
});

test("a page restored from the back-forward cache can start its trip again", async ({
  page,
}) => {
  await open(page, "/sign-in");
  const starts = await answerSignInStart(page);
  const trips = await stopTrips(page, `${githubOrigin}/**`);
  const control = page.getByTestId("github-entry");
  await control.click();
  await expect.poll(() => trips.length).toBe(1);
  await expect(control, "busy until the page leaves").toHaveText("Connecting…");
  await expect(control).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Connecting to GitHub…",
  );

  // Playwright runs Chromium without its back-forward cache, so the test
  // sends the event that the browser sends when it restores a page from it.
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await expect(control, "a restored page is at rest").toHaveText(
    "Continue with GitHub",
  );
  await expect(control).not.toHaveAttribute("aria-busy", "true");
  await control.click();
  await expect.poll(() => trips.length).toBe(2);
  expect(starts(), "the restored control starts the trip again").toBe(2);
});
