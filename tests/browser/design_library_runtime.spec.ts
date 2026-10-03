import fs from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { serve } from "../../dist/server/serve.js";
import { createCommittedExampleBaseline } from "../helpers/example_baseline.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { FULL_CATALOGUE_SETUP_TIMEOUT_MS } from "../helpers/fixture_timing.js";
import { waitForInitialChanges } from "../helpers/watched_catalogue.js";

import { chooseVariant, chooseViewport } from "./workspace_actions.js";

let running: Awaited<ReturnType<typeof serve>>;
let root: string;
test.beforeAll(async () => {
  test.setTimeout(FULL_CATALOGUE_SETUP_TIMEOUT_MS);
  root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/design-runtime-"),
  );
  const config = await createCommittedExampleBaseline(root, "design-library");
  running = await serve(config, { base: "HEAD", port: 0, watch: false });
  await waitForInitialChanges(running.url);
});
test.afterAll(async () => {
  await running?.close();
  if (root) await fs.rm(root, { recursive: true, force: true });
});

for (const viewport of ["desktop", "mobile"] as const) {
  test(`${viewport}: design props are temporary, support unset/reset, and load newly visible nested styles`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1280, height: 900 },
    );
    const paths = [
      "entries/design/library/chrome/top-bar.tsx",
      "generated/mokly-manifest.json",
    ];
    const contents = () =>
      Promise.all(
        paths.map((file) =>
          fs.readFile(path.join(root, "examples/basic", file), "utf8"),
        ),
      );
    const before = await contents();
    await page.goto(`${running.url}/view/components/design-ui-top-bar.html`);
    await chooseViewport(page, viewport);
    const status = page.locator("[data-workspace-status]");
    await expect(status).toHaveText("Unmodified");
    await page.getByRole("tab", { name: "Props", exact: true }).click();
    if (viewport === "mobile")
      await page
        .getByRole("button", { name: "Expand inspector", exact: true })
        .click();
    const frame = page.frameLocator(`[data-workspace-frame="${viewport}"]`);
    await page.getByLabel("Supply Query", { exact: true }).check();
    await page.getByLabel("Query", { exact: true }).fill("New search");
    await expect(frame.locator(".mbk-search-value")).toHaveText("New search");
    await page.getByLabel("Tag picker open", { exact: true }).check();
    await expect(frame.locator(".mbk-tag-picker")).toBeVisible();
    await expect(frame.locator(".mbk-chip").first()).toHaveCSS(
      "cursor",
      "pointer",
    );
    await page.getByLabel("Supply Query", { exact: true }).uncheck();
    await expect(frame.locator(".mbk-search-value")).toHaveCount(0);
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(frame.locator(".mbk-tag-picker")).toHaveCount(0);
    await expect(status).toHaveText("Unmodified");
    await chooseVariant(page, "Search");
    await expect(frame.locator(".mbk-search-value")).toHaveText("tag:forms");
    await expect(status).toHaveText("Unmodified");
    expect(await contents()).toEqual(before);
  });

  test(`${viewport}: real design usage supports nested inspection, highlighting and a round trip through the library`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1280, height: 900 },
    );
    await page.goto(
      `${running.url}/view/screens/design-browse-tag-picker.html`,
    );
    await chooseViewport(page, viewport);
    await page.getByRole("tab", { name: "Components", exact: true }).click();
    if (viewport === "mobile")
      await page
        .getByRole("button", { name: "Expand inspector", exact: true })
        .click();
    const panel = page.getByRole("tabpanel", {
      name: "Components",
      exact: true,
    });
    await expect(panel).toContainText("Top bar");
    await expect(panel).toContainText("Tag picker");
    await expect(panel).toContainText("Tag chip");
    const highlight = page.getByRole("button", {
      name: "Highlight components",
      exact: true,
    });
    await highlight.click();
    await expect(
      page.locator(
        `.mbk-highlight-layer[data-highlight-viewport="${viewport}"]`,
      ),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
    for (const summary of await panel.locator("details > summary").all()) {
      await summary.click();
      await expect(
        page.getByRole("tab", { name: "Components", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
    }
    await panel
      .locator(".mbk-instance-select")
      .filter({ hasText: "Tag chip" })
      .first()
      .click();
    await expect(
      page.getByRole("tabpanel", { name: "Props", exact: true }),
    ).toContainText("forms");
    await page
      .getByRole("link", { name: "Open component", exact: true })
      .click();
    await expect(page).toHaveURL(/\/view\/components\/design-ui-tag-chip.html/);
    await page.getByRole("tab", { name: "Usage", exact: true }).click();
    const usage = page.getByRole("tabpanel", { name: "Usage", exact: true });
    await usage
      .getByRole("link", { name: "Tag picker", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(
      /\/view\/screens\/design-browse-tag-picker.html/,
    );
    await page.goBack();
    await expect(page).toHaveURL(/\/view\/components\/design-ui-tag-chip.html/);
    await page.goForward();
    await expect(page).toHaveURL(
      /\/view\/screens\/design-browse-tag-picker.html/,
    );
  });
}
