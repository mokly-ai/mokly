import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { renderReviewArtifact } from "../../dist/review/artifact.js";
import { compareReview } from "../../dist/review/compare.js";
import { writeReviewArtifact } from "../../dist/review/write.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import type { RunningServer } from "../../dist/server/http_types.js";
import { componentReviewFixture } from "../helpers/component_review_fixture.js";

let server: RunningServer;
const cleanup: (() => Promise<void>)[] = [];

test.beforeAll(async () => {
  const fixture = await componentReviewFixture(
    { after: (dispose) => cleanup.push(dispose) },
    (source) =>
      source
        .replace(/ {2}defineScreen\([^\n]+\)\n/, "")
        .replace(
          ', { id: "action-disabled", title: "Disabled", props: { label: "Continue", disabled: true } }',
          "",
        )
        .replace(
          "<button data-viewport=",
          '<button className="changed" data-viewport=',
        ),
  );
  const compared = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  if (compared.result.schemaVersion !== 4)
    throw new Error("Expected component result");
  server = await startCatalogueServer(fixture.config, {
    base: "main",
    port: 0,
    componentChanges: {
      baseline: fixture.before.manifest,
      result: compared.result,
    },
    review: {
      base: "main",
      outDir: path.join(fixture.root, ".review"),
      generate: async () => {
        await writeReviewArtifact(
          renderReviewArtifact(compared),
          path.join(fixture.root, ".review"),
          fixture.config,
        );
      },
    },
  });
  fixture.beforeRemove(() => server.close());
});

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
  await page.goto(`${server.url}/view/components/action.html`);
  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  const removed = page
    .getByRole("region", { name: "Inspector", exact: true })
    .getByRole("link", { name: "Home · Removed", exact: true });
  await expect(removed).not.toHaveAttribute("href", /comparison=side/);
  await removed.click();
  await expectRemovedPrevious(page);

  await page.goto(`${server.url}/view/screens/home.html?comparison=side`);
  await expectRemovedPrevious(page);
});

test("removed component variants still honor eligible comparison URLs", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/components/action.html`);
  await page.click('[data-filter="changed"]');
  const removed = page.locator(
    'a[data-nav-row][data-route="components/action-disabled.html"]',
  );
  await expect(removed).toHaveAttribute(
    "href",
    /\/view\/components\/action-disabled\.html\?snapshot=[a-f0-9]{64}$/,
  );
  await removed.click();
  await expect(page).toHaveURL(
    /\/view\/components\/action-disabled\.html\?snapshot=[a-f0-9]{64}$/,
  );
  await expect(page.locator("[data-workspace-variant-status]")).toHaveText(
    "Disabled · Removed",
  );
  await expect(page.locator(".mbk-diff-toolbar")).toBeVisible();
  await page.getByRole("button", { name: "Side by side" }).click();
  await expect(page.locator("[data-current-screen]")).toBeHidden();
  await expect(page.locator("[data-diff-stage]")).toBeVisible();
  await expect(page.locator("[data-diff-stage] iframe")).toHaveCount(1);
  await expect(page.locator(".mb-pane-missing")).toContainText(
    "This screen was removed on this branch.",
  );
});
