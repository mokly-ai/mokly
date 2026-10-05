import path from "node:path";

import { expect, test } from "@playwright/test";

import { readCatalogueChanges } from "../../dist/server/component_changes.js";
import type { ServedReview } from "../../dist/server/configured_review.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import type { RunningServer } from "../../dist/server/http_types.js";
import type { ReviewResultV5 } from "../../packages/viewer/dist/review/component_types.js";
import { componentReviewFixture } from "../helpers/component_review_fixture.js";

const cleanup: (() => Promise<void>)[] = [];
let server: RunningServer;
let shouldFail = true;
let generations = 0;

test.beforeAll(async () => {
  const fixture = await componentReviewFixture(
    { after: (dispose) => cleanup.push(dispose) },
    (source) => source.replaceAll("Screen content", "Changed content"),
  );
  const changes = await readCatalogueChanges(
    fixture.config,
    fixture.after.manifest,
    "origin/main",
    fixture.git,
    "a".repeat(40),
  );
  const outDir = path.join(fixture.root, ".review");
  const result = {
    schemaVersion: 5 as const,
    baseCommit: "a".repeat(40),
    baseRef: "origin/main",
    changedPaths: [],
    ignoredImpact: [],
    screens: [],
    components: [],
    changes: [],
    affectedConsumers: [],
  } satisfies ReviewResultV5;
  const review: ServedReview = {
    base: "origin/main",
    async generate(): Promise<void> {
      throw new Error("The browser must request its selected comparison");
    },
    selected: {
      async generate() {
        generations += 1;
        if (shouldFail) throw new Error("temporary comparison failure");
        return { result, files: new Map() };
      },
    },
    outDir,
  };
  server = await startCatalogueServer(fixture.config, {
    base: "origin/main",
    changedEntries: ["home"],
    componentChanges: changes,
    port: 0,
    review,
  });
  fixture.beforeRemove(() => server.close());
});

test.afterAll(async () => {
  for (const dispose of cleanup.reverse()) await dispose();
});

test("a watched update resets failed diffs to Current without generating", async ({
  page,
}) => {
  const eventStream = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/__mokly/events" &&
      response.status() === 200,
  );
  await page.goto(`${server.url}/view/home/`);
  await eventStream;
  await page.getByRole("button", { name: "Overlay", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  expect(generations).toBe(1);
  shouldFail = false;
  server.publishUpdate({ version: 2, changedEntries: ["home"] });
  await expect(page.locator("html")).toHaveAttribute(
    "data-mokly-update-version",
    "2",
  );
  await page.waitForLoadState("load");
  await expect(
    page.getByRole("button", { name: "Current", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(generations).toBe(1);
  await page.getByRole("button", { name: "Overlay", exact: true }).click();
  await expect(page.locator("[data-diff-stage]")).toContainText(
    "This screen has no comparison available.",
  );
  expect(generations).toBe(2);
});
