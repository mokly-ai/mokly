import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { expect, test } from "@playwright/test";

import { componentRuntime } from "../../dist/build/component_runtime.js";
import { renderReviewArtifact } from "../../dist/review/artifact.js";
import { compareReview } from "../../dist/review/compare.js";
import { writeReviewArtifact } from "../../dist/review/write.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import type { RunningServer } from "../../dist/server/http_types.js";
import { controlsEntrySource } from "../helpers/component_controls_fixture.js";
import { componentReviewFixture } from "../helpers/component_review_fixture.js";

let server: RunningServer;
const cleanup: (() => Promise<void>)[] = [];
test.beforeAll(async () => {
  const fixture = await componentReviewFixture(
    {
      after: (fn) => {
        cleanup.push(fn);
      },
    },
    (source) =>
      source.replace(
        "<button data-viewport=",
        '<button className="revised" data-viewport=',
      ),
    controlsEntrySource(),
  );
  const compared = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  if (compared.result.schemaVersion !== 3)
    throw new Error("Expected component comparison");
  const result = compared.result;
  server = await startCatalogueServer(fixture.config, {
    base: "main",
    port: 0,
    componentRuntime: componentRuntime(fixture.after),
    componentChanges: { baseline: fixture.before.manifest, result },
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
});
test.afterAll(async () => {
  await server?.close();
  for (const dispose of cleanup.reverse()) await dispose();
});

for (const viewport of ["desktop", "mobile"] as const)
  test(`${viewport}: real controls edit, validate, switch views and restore saved variants`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "desktop"
        ? { width: 1280, height: 900 }
        : { width: 390, height: 844 },
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${server.url}/view/components/action.html`);
    await page.getByLabel("Viewport", { exact: true }).selectOption(viewport);
    await page.getByRole("tab", { name: "Props", exact: true }).click();
    if (viewport === "mobile")
      await page.getByRole("button", { name: /Expand inspector/ }).click();
    const frame = page.frameLocator(`[data-workspace-frame="${viewport}"]`);
    await page.getByLabel("Label", { exact: true }).fill("Purchase");
    await expect(frame.getByRole("button", { name: "Purchase" })).toBeVisible();
    await expect(page.getByLabel("Label", { exact: true })).toBeFocused();
    await page.getByLabel("Corner radius", { exact: true }).fill("30");
    await expect(
      page.getByLabel("Corner radius", { exact: true }),
    ).toHaveAttribute("aria-invalid", "true");
    await expect(
      frame.getByRole("button", { name: "Purchase" }),
    ).toHaveAttribute("data-radius", "4");
    await page.getByLabel("Corner radius", { exact: true }).fill("-0");
    await expect(
      frame.getByRole("button", { name: "Purchase" }),
    ).toHaveAttribute("data-radius", "-0");
    await page.getByLabel("Emphasis", { exact: true }).selectOption("1");
    await expect(frame.getByRole("button", { name: "Purchase" })).toHaveCSS(
      "font-weight",
      "400",
    );
    await page.getByLabel("Disabled", { exact: true }).check();
    await expect(
      frame.getByRole("button", { name: "Purchase" }),
    ).toBeDisabled();
    await page.getByLabel("Supply Hint", { exact: true }).uncheck();
    await expect(frame.locator("[data-hint]")).toHaveCount(0);
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await expect(
      frame.getByRole("button", { name: "Purchase" }),
    ).toHaveAttribute("data-scheme", "dark");
    await page.getByLabel("Viewport", { exact: true }).selectOption("both");
    for (const size of ["mobile", "desktop"])
      await expect(
        page
          .frameLocator(`[data-workspace-frame="${size}"]`)
          .getByRole("button", { name: "Purchase" }),
      ).toBeDisabled();
    await page.screenshot({
      path: `.context/component-controls-${viewport}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.getByLabel("Label", { exact: true })).toHaveValue(
      "Continue",
    );
    await expect(frame.getByRole("button", { name: "Continue" })).toBeEnabled();
    await page.getByLabel("Label", { exact: true }).fill("Temporary");
    await expect(
      frame.getByRole("button", { name: "Temporary" }),
    ).toBeVisible();
    await page
      .getByLabel("Saved variant", { exact: true })
      .selectOption("disabled");
    await expect(page.getByLabel("Label", { exact: true })).toHaveValue(
      "Continue",
    );
    await expect(
      frame.getByRole("button", { name: "Continue" }),
    ).toBeDisabled();
    expect(errors).toEqual([]);
  });

test("failed and superseded edits keep the last valid preview; comparisons restore saved props", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/components/action.html`);
  await page.getByLabel("Viewport", { exact: true }).selectOption("desktop");
  await page.getByRole("tab", { name: "Props", exact: true }).click();
  const frame = page.frameLocator('[data-workspace-frame="desktop"]');
  await page.getByLabel("Label", { exact: true }).fill("Valid");
  await expect(frame.getByRole("button", { name: "Valid" })).toBeVisible();
  await page.getByLabel("Label", { exact: true }).fill("Fail");
  await expect(page.getByRole("alert")).toContainText("could not be rendered");
  await expect(frame.getByRole("button", { name: "Valid" })).toBeVisible();
  await page.getByLabel("Label", { exact: true }).fill("Hang");
  await expect(page.locator("[data-controls-status]")).toContainText(
    "Updating",
  );
  await page.getByLabel("Label", { exact: true }).fill("Newest");
  await expect(frame.getByRole("button", { name: "Newest" })).toBeVisible();
  await page.getByRole("button", { name: "Overlay", exact: true }).click();
  await expect(page.getByLabel("Label", { exact: true })).toHaveValue(
    "Continue",
  );
  await expect(page.getByLabel("Label", { exact: true })).toBeDisabled();
  await expect(page.locator("[data-controls-status]")).toContainText(
    "saved variant",
  );
  await page.getByRole("button", { name: "Current", exact: true }).click();
  await expect(page.getByLabel("Label", { exact: true })).toBeEnabled();
  await expect(frame.getByRole("button", { name: "Continue" })).toBeVisible();
});

test("expired previews can be rendered again and navigation discards temporary edits", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/components/action.html`);
  await page.getByLabel("Viewport", { exact: true }).selectOption("desktop");
  await page.getByRole("tab", { name: "Props", exact: true }).click();
  let expire = true;
  await page.route("**/__mokly/components/renders/**", async (route) => {
    if (route.request().method() === "HEAD" && expire) {
      expire = false;
      await route.fulfill({ status: 410 });
    } else await route.continue();
  });
  await page.getByLabel("Label", { exact: true }).fill("Retained edit");
  await expect(page.locator("[data-controls-status]")).toContainText("expired");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator("[data-controls-status]")).toHaveText(
    "Edited props",
  );
  await page.locator('[data-nav-row][data-entry-id="home"]').click();
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  await page.locator('[data-nav-row][data-entry-id="action"]').click();
  await page.getByRole("tab", { name: "Props", exact: true }).click();
  await expect(page.getByLabel("Label", { exact: true })).toHaveValue(
    "Continue",
  );
});

test("changing context while the first edit is pending cannot apply an obsolete preview", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/components/action.html`);
  await page.getByLabel("Viewport", { exact: true }).selectOption("desktop");
  await page.getByRole("tab", { name: "Props", exact: true }).click();
  await page.route("**/__mokly/components/render", async (route) => {
    const response = await route.fetch();
    if (route.request().postDataJSON().colorScheme === "light")
      await delay(250);
    await route.fulfill({ response });
  });
  const pending = page.waitForRequest((request) =>
    request.url().endsWith("/components/render"),
  );
  await page.getByLabel("Label", { exact: true }).fill("Context edit");
  await pending;
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await expect(
    page
      .frameLocator('[data-workspace-frame="desktop"]')
      .getByRole("button", { name: "Context edit" }),
  ).toHaveAttribute("data-scheme", "dark");
});
