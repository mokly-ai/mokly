import path from "node:path";

import { expect, test } from "@playwright/test";

import { renderReviewArtifact } from "../../dist/review/artifact.js";
import { compareReview } from "../../dist/review/compare.js";
import { writeReviewArtifact } from "../../dist/review/write.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import type { RunningServer } from "../../dist/server/http_types.js";
import { componentReviewFixture } from "../helpers/component_review_fixture.js";

import { loadComparison } from "./comparison_actions.js";

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
      source
        .replace(
          "<button data-viewport=",
          '<button className="revised" data-viewport=',
        )
        .replace(
          '{ id: "disabled", title: "Disabled", props: { label: "Continue", disabled: true } }]',
          '{ id: "disabled", title: "Disabled", props: { label: "Continue", disabled: true } }, { id: "new", title: "New", props: { label: "New" } }]',
        ),
  );
  const compared = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  if (compared.result.schemaVersion !== 3)
    throw new Error("Expected component result");
  const result = compared.result;
  server = await startCatalogueServer(fixture.config, {
    base: "main",
    port: 0,
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

test("saved variants, actual contexts, inspector tabs, and history work in the real shell", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${server.url}/view/components/action.html`);
  await expect(
    page.getByRole("heading", { name: "Action", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Nested components" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "Details", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const mobile = page.frameLocator('[data-workspace-frame="mobile"]');
  await expect(
    mobile.getByRole("button", { name: "Continue" }),
  ).toHaveAttribute("data-viewport", "mobile");
  await page
    .getByLabel("Saved variant", { exact: true })
    .selectOption("disabled");
  await expect(page).toHaveURL(/variant=disabled/);
  await expect(mobile.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.getByRole("tab", { name: "Props", exact: true }).click();
  await expect(page.locator('[data-prop-control="disabled"]')).toBeChecked();
  await expect(page.locator('[data-prop-control="disabled"]')).toBeDisabled();
  await page.getByRole("button", { name: "Close inspector" }).click();
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(
    0,
  );
  await page.goBack();
  await expect(page.getByLabel("Saved variant", { exact: true })).toHaveValue(
    "default",
  );
  await expect(mobile.getByRole("button", { name: "Continue" })).toBeEnabled();
  await page.goto(`${server.url}/view/components/action.html?variant=missing`);
  await expect(
    page.getByRole("status").filter({ hasText: "This saved variant" }),
  ).toBeVisible();
  await page
    .getByLabel("Saved variant", { exact: true })
    .selectOption("default");
  await expect(mobile.getByRole("button", { name: "Continue" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("screen inspection records real nested, repeated and hidden instances without listing the screen in Changes", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/screens/home.html`);
  await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");
  await expect(
    page.locator('[data-nav-row][data-route="screens/home.html"]'),
  ).not.toHaveAttribute("data-changed", "true");
  await page.getByRole("tab", { name: "Components", exact: true }).click();
  await expect(
    page.getByRole("tabpanel", { name: "Components", exact: true }),
  ).toContainText("5 instances");
  const highlight = page.getByRole("button", {
    name: "Highlight components",
    exact: true,
  });
  await expect(highlight).toBeEnabled();
  await highlight.click();
  await expect(
    page.locator('.mbk-highlight-layer[data-highlight-viewport="desktop"]'),
  ).toBeVisible();
  await expect(
    page.locator(".mbk-highlight-label").filter({ hasText: "hidden" }),
  ).toHaveCount(0);
  await page
    .locator(".mbk-highlight-label")
    .filter({ hasText: "footer" })
    .first()
    .click();
  await expect(
    page.getByRole("tabpanel", { name: "Props", exact: true }),
  ).toContainText("Finish");
  await page.keyboard.press("Escape");
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
  await expect(highlight).toBeFocused();
  await page.getByRole("link", { name: "Open component", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Action", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
});

test("desktop divider stays centered while resizing and mobile sheet keeps the page bounded", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${server.url}/view/components/pane.html`);
  const divider = page.getByRole("separator", { name: "Resize inspector" });
  await expect(divider).toBeVisible();
  const before = await page.locator("[data-workspace-inspector]").boundingBox();
  const handle = await divider.boundingBox();
  expect(
    Math.abs(handle!.y + handle!.height / 2 - before!.y),
  ).toBeLessThanOrEqual(1);
  await divider.focus();
  await page.keyboard.press("ArrowUp");
  const after = await page.locator("[data-workspace-inspector]").boundingBox();
  expect(after!.height).toBeGreaterThan(before!.height);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(divider).toBeHidden();
  const sheet = page.getByRole("button", {
    name: "Expand inspector",
    exact: true,
  });
  await expect(sheet).toBeVisible();
  const compact = await page
    .locator("[data-workspace-inspector]")
    .boundingBox();
  await sheet.click();
  const expanded = await page
    .locator("[data-workspace-inspector]")
    .boundingBox();
  expect(expanded!.height).toBeGreaterThan(compact!.height);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
});

test("component comparisons follow changed variants while added variants stay current", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/components/action.html`);
  await page.getByLabel("Viewport", { exact: true }).selectOption("mobile");
  await loadComparison(page, "Overlay");
  await expect(page.locator("[data-diff-stage] iframe")).toHaveCount(2);
  await expect(
    page.locator("[data-diff-stage] [data-workspace-evidence]"),
  ).toHaveCount(0);
  await expect(
    page.locator("[data-diff-stage] .mbk-comparison-evidence"),
  ).toHaveCount(0);
  await expect(page.locator("[data-workspace-evidence]")).toHaveCount(1);
  await expect(page.locator(".mbk-comparison-evidence")).toHaveCount(1);
  await expect(
    page.locator(
      '[data-inspector-panel="details"] [data-workspace-evidence].mbk-comparison-evidence',
    ),
  ).toHaveCount(1);
  await expect(page.locator('[data-inspector-panel="details"]')).toContainText(
    "Rendered content changed.",
  );
  await expect(
    page.getByRole("button", { name: "Highlight components", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Saved variant", { exact: true })
    .selectOption("disabled");
  await expect(page.locator("[data-diff-stage] iframe").last()).toHaveAttribute(
    "src",
    /disabled\.mobile\.html$/,
  );
  await page.getByRole("button", { name: "Current", exact: true }).click();
  await expect(
    page
      .frameLocator('[data-workspace-frame="mobile"]')
      .getByRole("button", { name: "Continue" }),
  ).toBeDisabled();
  await page.getByLabel("Saved variant", { exact: true }).selectOption("new");
  await expect(page.locator("[data-workspace-variant-status]")).toHaveText(
    "New · Added",
  );
  await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
  await expect(
    page
      .frameLocator('[data-workspace-frame="mobile"]')
      .getByRole("button", { name: "New", exact: true }),
  ).toBeVisible();
});

test("Used by links select a real screen instance and clear stale selection on navigation", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/components/action.html`);
  await page.getByRole("tab", { name: "Usage", exact: true }).click();
  await page
    .getByRole("tabpanel", { name: "Usage", exact: true })
    .getByRole("link", { name: "Home", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(
    /screens\/home\.html\?viewport=mobile&scheme=light&instance=[a-f0-9]{64}/,
  );
  await expect(
    page.getByRole("tab", { name: "Props", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("tabpanel", { name: "Props", exact: true }),
  ).toContainText("Action");
  await expect(
    page.getByRole("tabpanel", { name: "Props", exact: true }),
  ).toContainText("Slot action");
  await expect(page.getByLabel("Viewport", { exact: true })).toHaveValue(
    "mobile",
  );
});

test("nested selection and frame Escape preserve focus and consumer markup", async ({
  page,
}) => {
  await page.goto(`${server.url}/view/screens/home.html`);
  await page.getByLabel("Viewport", { exact: true }).selectOption("desktop");
  await expect(
    page.getByRole("button", { name: "Highlight components", exact: true }),
  ).toBeEnabled();
  const frame = page.frameLocator('[data-workspace-frame="desktop"]');
  const html = await frame.locator("body").innerHTML();
  await page.getByRole("tab", { name: "Components", exact: true }).click();
  await page.getByText("1 nested instances", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Highlight components", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator(
      '[data-inspector-panel="components"] [aria-pressed="true"][data-instance-key]',
    ),
  ).toHaveCount(1);
  await expect(page.locator(".mbk-highlight-label")).toHaveCount(1);
  await frame.getByRole("button", { name: "Inside", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Highlight components", exact: true }),
  ).toBeFocused();
  expect(await frame.locator("body").innerHTML()).toBe(html);
});
