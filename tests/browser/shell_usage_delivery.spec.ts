/**
 * Usage delivery on the example Serve host, under the component explorer and
 * shell delivery contracts: Usage shows `Loading usage…` until the detail
 * arrives and never a false zero, an instance deep link selects its instance
 * once the detail arrives, and use-case and page frames load and navigate
 * while usage and resource evidence are unavailable.
 */

import { expect, type Page, type Route } from "@playwright/test";

import { test } from "./browser_test.js";
import { mainHeading } from "./main_heading.js";
import { useCaseStepFrame, useCaseSteps } from "./use_case_steps.js";
import { DOCUMENT_FRAME, openInspectFold } from "./workspace_actions.js";

/** Hold the first read of one entry detail; later reads continue. */
async function holdDetail(page: Page, entryPath: string) {
  const held: Route[] = [];
  let reads = 0;
  await page.route(`**/mokly-viewer/entries/${entryPath}.json`, (route) => {
    reads += 1;
    if (held.length) return route.continue();
    held.push(route);
  });
  return {
    held,
    reads: () => reads,
    release: () => held[0]!.continue(),
  };
}

test("Usage shows Loading usage until the detail arrives, then the complete list, never the empty state", async ({
  page,
}) => {
  await page.goto("/view/example/components/toolbar/");
  await expect(mainHeading(page, "Toolbar")).toBeVisible();
  await openInspectFold(page, "usage");
  // Record whether the zero-consumer state ever renders.
  await page.evaluate(() => {
    const record = document.documentElement;
    new MutationObserver(() => {
      if (document.body.innerText.includes("No recorded consumers."))
        record.dataset["sawEmptyUsage"] = "";
    }).observe(document.body, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  });
  const detail = await holdDetail(page, "example/components/action");
  await page
    .locator(
      'nav.mbk-nav a[data-nav-row][data-route="example/components/action/index.html"]',
    )
    .click();
  await expect.poll(() => detail.held.length).toBe(1);
  await expect(mainHeading(page, "Action")).toBeVisible();
  const usage = await openInspectFold(page, "usage");
  await expect(usage).toHaveText("Loading usage…");
  await expect(page.locator("[data-mokly-stage] [role=status]")).toHaveText(
    "Loading preview…",
  );

  await detail.release();
  await expect(usage.getByRole("heading", { name: "Used by" })).toBeVisible();
  for (const name of ["Welcome", "Details", "Toolbar"])
    await expect(
      usage.getByRole("link", { name, exact: true }).first(),
    ).toBeVisible();
  await expect(usage).not.toContainText("Loading usage…");
  await expect(page.locator("#mb-main iframe").first()).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-saw-empty-usage",
  );
  expect(detail.reads()).toBe(1);
});

test("a variant Usage waits for its parent detail and reuses it for a sibling", async ({
  page,
}) => {
  const detail = await holdDetail(page, "example/components/action");
  await page.goto("/view/example/components/action/default/");
  await expect(mainHeading(page, "Action")).toBeVisible();
  const usage = await openInspectFold(page, "usage");
  await expect.poll(() => detail.held.length).toBe(1);
  await expect(usage).toHaveText("Loading usage…");
  await expect(page.locator("[data-mokly-stage] [role=status]")).toHaveText(
    "Loading preview…",
  );

  await detail.release();
  await expect(usage.getByRole("heading", { name: "Used by" })).toBeVisible();
  for (const name of ["Welcome", "Details", "Toolbar"])
    await expect(
      usage.getByRole("link", { name, exact: true }).first(),
    ).toBeVisible();
  expect(detail.reads()).toBe(1);

  // The variant set read the sibling's detail with this route, so the
  // sibling's route reads neither its own detail nor the parent's again.
  const sibling = await holdDetail(page, "example/components/action/disabled");
  await page
    .locator(
      'nav.mbk-nav a[data-nav-row][data-route="example/components/action/disabled/index.html"]',
    )
    .click();
  await expect(page).toHaveURL(
    /\/view\/example\/components\/action\/disabled\/$/u,
  );
  await expect(mainHeading(page, "Action")).toBeVisible();
  await expect(usage.getByRole("heading", { name: "Used by" })).toBeVisible();
  expect(sibling.reads()).toBe(0);
  expect(detail.reads()).toBe(1);
});

test("an instance deep link selects its instance once the destination detail arrives", async ({
  page,
}) => {
  await page.goto("/view/example/components/action/");
  const usage = await openInspectFold(page, "usage");
  const link = usage.getByRole("link", { name: "Welcome", exact: true });
  const href = await link.getAttribute("href");
  const instance = new URL(href!, "http://mokly.invalid").searchParams.get(
    "instance",
  );
  expect(instance).toMatch(/^[a-f0-9]{64}$/u);
  const detail = await holdDetail(page, "example/screens/welcome");
  await link.click();
  await expect.poll(() => detail.held.length).toBe(1);
  await expect(page).toHaveURL(new RegExp(`[?&]instance=${instance}(?:&|$)`));
  await expect(await openInspectFold(page, "components")).toHaveText(
    "Waiting for the component preview.",
  );

  // The route's instance selects once its frame's usage is ready, and
  // Inspect's Selection names its props.
  await detail.release();
  await expect(
    page.locator('[data-inspect-section="selection"]'),
  ).toContainText("View details");
  await expect(
    page.locator(`[data-instance-key="${instance}"]`),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(new RegExp(`[?&]instance=${instance}(?:&|$)`));
});

test("use-case and page frames load and navigate while usage and resource evidence are unavailable", async ({
  page,
}) => {
  // Serve publishes ready usage for the example, so the details of the tour's
  // step screens say that their usage is unavailable, and the page's detail
  // carries no resource evidence.
  await page.route(
    /\/mokly-viewer\/entries\/example\/(screens\/welcome|screens\/details|getting-started)\.json$/u,
    async (route) => {
      const response = await route.fetch();
      const detail = await response.json();
      for (const view of detail.views) view.usage = { status: "unavailable" };
      delete detail.workspace;
      delete detail.resourceEvidence;
      await route.fulfill({ response, json: detail });
    },
  );
  await page.goto("/view/example/tour/");
  await expect(mainHeading(page, "Example tour")).toBeVisible();
  await expect(useCaseSteps(page)).toHaveCount(2);
  for (const step of [1, 2])
    await expect(useCaseStepFrame(page, step)).toHaveAttribute(
      "data-mokly-frame-state",
      "ready",
    );
  await useCaseStepFrame(page, 1)
    .contentFrame()
    .getByRole("link", { name: "View details", exact: true })
    .click();
  await expect(page).toHaveURL(
    /\/view\/example\/screens\/details\/\?fragment=details$/u,
  );
  await expect(mainHeading(page, "Details")).toBeVisible();
  await expect(await openInspectFold(page, "components")).toContainText(
    "Component inspection is unavailable for this view.",
  );

  await page
    .locator(
      'nav.mbk-nav a[data-nav-row][data-route="example/getting-started/index.html"]',
    )
    .click();
  await expect(mainHeading(page, "Getting started")).toBeVisible();
  const document = page.locator(DOCUMENT_FRAME);
  await expect(document).toHaveAttribute("data-mokly-frame-state", "ready");
  await page
    .frameLocator(DOCUMENT_FRAME)
    .getByRole("link", { name: "Open Welcome" })
    .click();
  await expect(page).toHaveURL(/\/view\/example\/screens\/welcome\/$/u);
  await expect(mainHeading(page, "Welcome")).toBeVisible();
});
