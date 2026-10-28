/**
 * Usage delivery on the example Serve host, under the component explorer and
 * shell delivery contracts: Usage shows `Loading usage…` until the detail
 * arrives and never a false zero, an instance deep link selects its instance
 * once the detail arrives, and use-case and page frames load and navigate
 * while usage and resource evidence are unavailable.
 */

import { expect, type Page, type Route } from "@playwright/test";

import { test } from "./browser_test.js";

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

/** Open an inspector panel; a click on the selected icon would close it. */
async function openPanel(page: Page, name: string) {
  const tab = page.getByRole("tab", { name, exact: true });
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  return page.getByRole("tabpanel", { name, exact: true });
}

test("Usage shows Loading usage until the detail arrives, then the complete list, never the empty state", async ({
  page,
}) => {
  await page.goto("/view/example/components/toolbar/");
  await expect(page.locator("#mb-main h2").first()).toHaveText("Toolbar");
  await openPanel(page, "Usage");
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
  await expect(page.locator("#mb-main h2").first()).toHaveText("Action");
  const usage = page.getByRole("tabpanel", { name: "Usage", exact: true });
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
  await expect(page.locator("#mb-main h2").first()).toHaveText("Action");
  const usage = await openPanel(page, "Usage");
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

  const sibling = await holdDetail(page, "example/components/action/disabled");
  await page
    .getByRole("navigation", { name: "Saved variants" })
    .getByRole("link", { name: "Disabled", exact: true })
    .click();
  await expect.poll(() => sibling.held.length).toBe(1);
  await sibling.release();
  await expect(page).toHaveURL(
    /\/view\/example\/components\/action\/disabled\/$/u,
  );
  await expect(page.locator("#mb-main h2").first()).toHaveText("Action");
  await expect(usage.getByRole("heading", { name: "Used by" })).toBeVisible();
  expect(detail.reads()).toBe(1);
});

test("an instance deep link selects its instance once the destination detail arrives", async ({
  page,
}) => {
  await page.goto("/view/example/components/action/");
  const usage = await openPanel(page, "Usage");
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
  await expect(await openPanel(page, "Components")).toHaveText(
    "Waiting for the component preview.",
  );

  await detail.release();
  await expect(
    page.getByRole("tab", { name: "Props", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("tabpanel", { name: "Props", exact: true }),
  ).toContainText("View details");
  await openPanel(page, "Components");
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
  await expect(page.locator("#mb-main h2").first()).toHaveText("Example tour");
  const steps = page.locator(".mbk-flow-screen iframe");
  await expect(steps).toHaveCount(2);
  for (const step of await steps.all())
    await expect(step).toHaveAttribute("data-mokly-frame-state", "ready");
  await page
    .frameLocator(".mbk-flow-screen iframe")
    .first()
    .getByRole("link", { name: "View details", exact: true })
    .click();
  await expect(page).toHaveURL(
    /\/view\/example\/screens\/details\/\?fragment=details$/u,
  );
  await expect(page.locator("#mb-main h2").first()).toHaveText("Details");
  await expect(await openPanel(page, "Components")).toContainText(
    "Component inspection is unavailable for this view.",
  );

  await page
    .locator(
      'nav.mbk-nav a[data-nav-row][data-route="example/getting-started/index.html"]',
    )
    .click();
  await expect(page.locator("#mb-main h2").first()).toHaveText(
    "Getting started",
  );
  const document = page.locator(".mbk-stage-embed iframe");
  await expect(document).toHaveAttribute("data-mokly-frame-state", "ready");
  await page
    .frameLocator(".mbk-stage-embed iframe")
    .getByRole("link", { name: "Open Welcome" })
    .click();
  await expect(page).toHaveURL(/\/view\/example\/screens\/welcome\/$/u);
  await expect(page.locator("#mb-main h2").first()).toHaveText("Welcome");
});
