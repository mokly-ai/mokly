import { expect, test, type Page } from "@playwright/test";

import { readCatalogueChanges } from "../../packages/mokly/dist/server/component_changes.js";
import { configuredServedReview } from "../../packages/mokly/dist/server/configured_review.js";
import { startCatalogueServer } from "../../packages/mokly/dist/server/http.js";
import type { RunningServer } from "../../packages/mokly/dist/server/http_types.js";
import { componentReviewFixture } from "../helpers/component_review_fixture.js";

let server: RunningServer;
let changedServer: RunningServer;
const cleanup: (() => Promise<void>)[] = [];

test.beforeAll(async () => {
  server = await removedFixture(false);
  changedServer = await removedFixture(true);
});

async function removedFixture(changeAction: boolean): Promise<RunningServer> {
  const fixture = await componentReviewFixture(
    { after: (dispose) => cleanup.push(dispose) },
    (source) =>
      source
        .replace(/ {2}defineScreen\([^\n]+\)\n/, "")
        .replace(
          ', { slug: "disabled", title: "Disabled", props: { label: "Continue", disabled: true } }',
          "",
        )
        .replace(
          "<button data-viewport=",
          changeAction
            ? '<button className="changed" data-viewport='
            : "<button data-viewport=",
        ),
  );
  const changes = await readCatalogueChanges(
    fixture.config,
    fixture.after.manifest,
    "main",
    fixture.git,
    "a".repeat(40),
  );
  if (!changes.result) throw new Error("Expected component result");
  expect(
    changes.result.changes.some((entry) => entry.after?.path === "action"),
  ).toBe(changeAction);
  const running = await startCatalogueServer(fixture.config, {
    base: "main",
    port: 0,
    componentChanges: changes,
    review: configuredServedReview(fixture.config, "main", fixture.git),
  });
  fixture.beforeRemove(() => running.close());
  return running;
}

test.afterAll(async () => {
  for (const dispose of cleanup.reverse()) await dispose();
});

async function expectRemovedPrevious(page: Page) {
  await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
  await expect(page.locator(".mbk-diff-toolbar")).toHaveCount(0);
  await expect(
    page.locator("[data-current-screen], [data-diff-stage]"),
  ).toHaveCount(0);
  await expect(page.locator(".mbk-previous")).toHaveText(
    "Showing previous version",
  );
  await expect(
    page.locator("[data-mokly-preview] iframe").first(),
  ).toBeVisible();
}

test("removed affected-screen links and legacy comparison URLs stay current", async ({
  page,
}) => {
  await page.goto(`${changedServer.url}/view/action/`);
  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  const removed = page
    .getByRole("region", { name: "Inspector", exact: true })
    .getByRole("link", { name: "Home · Removed", exact: true });
  await expect(removed).not.toHaveAttribute("href", /comparison=side/);
  await removed.click();
  await expectRemovedPrevious(page);

  await page.goto(`${changedServer.url}/view/home/?comparison=side`);
  await expectRemovedPrevious(page);
});

for (const changed of [false, true])
  test(`removed component variants keep eligible comparisons from ${changed ? "a changed" : "an unchanged"} parent`, async ({
    page,
  }) => {
    await page.goto(`${(changed ? changedServer : server).url}/view/action/`);
    await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
      "both",
    );
    await page.click('[data-filter="changed"]');
    const removed = page.locator(
      'a[data-nav-row][data-route="action/disabled/index.html"]',
    );
    await expect(removed).toHaveAttribute(
      "href",
      /\/view\/action\/disabled\/\?snapshot=[a-f0-9]{64}$/,
    );
    await removed.click();
    await expect(page).toHaveURL(
      /\/view\/action\/disabled\/\?snapshot=[a-f0-9]{64}$/,
    );
    await expect(page.locator("[data-workspace-variant-status]")).toHaveText(
      "Disabled · Removed",
    );
    await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
      changed ? "both" : "mobile",
    );
    await expect(page.locator(".mbk-diff-toolbar")).toBeVisible();
    await page.getByRole("button", { name: "Side by side" }).click();
    await expect(page.locator("[data-current-screen]")).toBeHidden();
    await expect(page.locator("[data-diff-stage]")).toBeVisible();
    const panes = changed ? 2 : 1;
    await expect(page.locator("[data-diff-stage] iframe")).toHaveCount(panes);
    await expect(page.locator(".mb-pane-missing")).toHaveCount(panes);
    await expect(page.locator(".mb-pane-missing")).toContainText(
      Array.from(
        { length: panes },
        () => "This screen was removed on this branch.",
      ),
    );
  });
