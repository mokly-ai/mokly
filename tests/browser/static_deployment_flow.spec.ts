/**
 * A use case whose step screen the next deployment removed: the outgoing
 * document keeps its loading stage until the full page load, whether the
 * removed step's detail fails after the deployment changed or before.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { expect, type Page, type Route } from "@playwright/test";

import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";
import { buildStaticCatalogue } from "../helpers/build_site.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { test } from "./browser_test.js";
import { missingResourceNotice } from "./document_error_allowance.js";
import { staticRequests } from "./static_delivery_assertions.js";

const STEPS = (paths: readonly string[]) =>
  `title: Tour\nsteps:\n${paths
    .map(
      (screenPath) =>
        `  - screenPath: ${screenPath}\n    title: ${screenPath}\n`,
    )
    .join("")}`;

const STEP_URL = "/mokly-viewer/entries/extra.json";
const SETTLED_URL = "/__mokly-test/step-answered";
/** Whether the outgoing document ever showed a stage that could not be shown. */
const UNAVAILABLE_SEEN = "mokly-test-unavailable-seen";
/** The outgoing stage's busy state after the shell handled the step's answer. */
const STAGE_BUSY = "mokly-test-stage-busy";

/**
 * In the outgoing document, record any stage that could not be shown, and
 * after the shell handled the removed step's answer, record the stage and
 * request `SETTLED_URL`. Two tasks let the shell's handling and its render
 * finish first.
 */
async function recordStepAnswer(page: Page): Promise<void> {
  await page.evaluate(
    ({ settledUrl, stageKey, stepUrl, unavailableKey }) => {
      new MutationObserver(() => {
        for (const alert of document.querySelectorAll('[role="alert"]'))
          if (alert.textContent?.includes("could not be shown"))
            sessionStorage.setItem(unavailableKey, alert.textContent);
      }).observe(document.documentElement, {
        characterData: true,
        childList: true,
        subtree: true,
      });
      const original = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const answer = original(input, init);
        const url = input instanceof Request ? input.url : String(input);
        const report = () =>
          setTimeout(() =>
            setTimeout(() => {
              const stage = document.querySelector("[data-mokly-stage]");
              sessionStorage.setItem(
                stageKey,
                stage?.getAttribute("aria-busy") ?? "absent",
              );
              void original(settledUrl);
            }),
          );
        if (url.endsWith(stepUrl)) answer.then(report, report);
        return answer;
      };
    },
    {
      settledUrl: SETTLED_URL,
      stageKey: STAGE_BUSY,
      stepUrl: STEP_URL,
      unavailableKey: UNAVAILABLE_SEEN,
    },
  );
}

let root: string;
let first: string;
let next: string;
/** The copy that the static host publishes now. */
let site: string;
let host: Awaited<ReturnType<typeof serveStaticFiles>>;
test.beforeAll(async () => {
  root = await fs.mkdtemp(
    path.join(
      process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"] ??
        path.join(repositoryRoot, ".context"),
      "static-flow-",
    ),
  );
  ownBrowserCleanup(async () => {
    await host?.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  const source = path.join(root, "source");
  first = path.join(root, "site");
  next = path.join(root, "next");
  await fs.mkdir(path.join(source, "specs"), { recursive: true });
  await fs.writeFile(
    path.join(source, "mokly.config.json"),
    JSON.stringify({ repoRoot: ".", roots: [{ dir: "specs" }] }),
  );
  await fs.writeFile(
    path.join(source, "specs/home.screen.html"),
    "---\ntitle: Home\nuseCasePaths: [tour]\n---\n<main>Home</main>",
  );
  await fs.writeFile(
    path.join(source, "specs/extra.screen.html"),
    "---\ntitle: Extra\nuseCasePaths: [tour]\n---\n<main>Extra step</main>",
  );
  await fs.writeFile(
    path.join(source, "specs/tour.use-case.yaml"),
    STEPS(["home", "extra"]),
  );
  await buildStaticCatalogue(source, path.join(source, "built"));
  await fs.cp(path.join(source, "built"), first, { recursive: true });
  await fs.rm(path.join(source, "specs/extra.screen.html"));
  await fs.writeFile(
    path.join(source, "specs/tour.use-case.yaml"),
    STEPS(["home"]),
  );
  await buildStaticCatalogue(source, path.join(source, "next"));
  await fs.cp(path.join(source, "next"), next, { recursive: true });
  await fs.rm(source, { recursive: true });
  site = first;
  host = await serveStaticFiles(() => site);
});
test.beforeEach(() => {
  site = first;
});

test("a removed step that fails after another deployment keeps the use case loading", async ({
  page,
}) => {
  const requests = staticRequests(page);
  await page.goto(`${host.url}/view/home/`);
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
  await recordStepAnswer(page);
  let step: Route | undefined;
  let pageLoad: Route | undefined;
  let stepHeld!: () => void;
  let pageLoadHeld!: () => void;
  let answered!: () => void;
  const held = Promise.all([
    new Promise<void>((resolve) => (stepHeld = resolve)),
    new Promise<void>((resolve) => (pageLoadHeld = resolve)),
  ]);
  const settled = new Promise<void>((resolve) => (answered = resolve));
  await page.route(`**${STEP_URL}`, (route) => {
    step = route;
    stepHeld();
  });
  await page.route(`**${SETTLED_URL}`, async (route) => {
    await route.fulfill({ status: 204 });
    answered();
  });
  await page.route(`${host.url}/view/tour/`, async (route) => {
    if (!route.request().isNavigationRequest()) await route.continue();
    else {
      pageLoad = route;
      pageLoadHeld();
    }
  });
  site = next;
  await page.locator('a[data-route="tour/index.html"]').click();
  // The tour's own detail comes from the next deployment, so the outgoing
  // document asks for a full page load. Hold that load, and only then answer
  // the removed step, which the next deployment no longer has. The outgoing
  // document runs no test script while its page load waits, so it reports
  // through session storage and one request of its own.
  await held;
  await step!.continue().catch(() => undefined);
  await settled;
  const reloaded = page.waitForEvent("load");
  await pageLoad!.continue();
  await reloaded;
  await expect(page.locator("#mb-main h2")).toHaveText("Tour");
  expect(
    await page.evaluate(
      (keys) => keys.map((key) => sessionStorage.getItem(key)),
      [UNAVAILABLE_SEEN, STAGE_BUSY],
    ),
  ).toEqual([null, "true"]);
  requests.assert();
});

test("a removed step that fails before the other details keeps the use case loading", async ({
  page,
  allowBrowserError,
}) => {
  allowBrowserError(missingResourceNotice(`${host.url}${STEP_URL}`));
  const failures: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(`${host.url}/view/home/`);
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
  await recordStepAnswer(page);
  let useCase: Route | undefined;
  let useCaseHeld!: () => void;
  let answered!: () => void;
  const held = new Promise<void>((resolve) => (useCaseHeld = resolve));
  const settled = new Promise<void>((resolve) => (answered = resolve));
  await page.route("**/mokly-viewer/entries/tour.json", async (route) => {
    if (useCase) await route.continue();
    else {
      useCase = route;
      useCaseHeld();
    }
  });
  await page.route(`**${SETTLED_URL}`, async (route) => {
    await route.fulfill({ status: 204 });
    answered();
  });
  site = next;
  await page.locator('a[data-route="tour/index.html"]').click();
  // Hold the tour's own detail, which shows the next deployment, until the
  // shell has handled the removed step's 404. The step failed first, but the
  // tour still loads, so the stage keeps loading.
  await held;
  await settled;
  await expect(page.locator("#mb-main [data-mokly-stage]")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  const reloaded = page.waitForEvent("load");
  await useCase!.continue();
  await reloaded;
  await expect(page.locator("#mb-main h2")).toHaveText("Tour");
  expect(
    await page.evaluate(
      (keys) => keys.map((key) => sessionStorage.getItem(key)),
      [UNAVAILABLE_SEEN, STAGE_BUSY],
    ),
  ).toEqual([null, "true"]);
  expect(failures).toEqual([`404 ${host.url}${STEP_URL}`]);
});
