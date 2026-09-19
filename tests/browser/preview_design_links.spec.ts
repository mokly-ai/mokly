import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { repositoryRoot, validEntrySource } from "../helpers/fixture.js";
import { createPreviewComparisonFixture } from "../helpers/preview_comparison_fixture.js";

import { focusDesignLink } from "./design_test_helpers.js";
import {
  servePreviewFixture,
  startPreviewFixture,
  type PreviewFixture,
} from "./preview_fixture.js";
import {
  chooseScheme,
  chooseViewport,
  expectFrameSource,
} from "./workspace_actions.js";

let comparisonFixture: Awaited<
  ReturnType<typeof createPreviewComparisonFixture>
>;
let comparisonPreview: PreviewFixture;
let preview: PreviewFixture;
test.describe.configure({ timeout: 90_000 });

test.beforeAll(async () => {
  test.setTimeout(180_000);
  const before = await generatedDigest();
  preview = await startPreviewFixture();
  expect(await generatedDigest()).toBe(before);
  comparisonFixture = await createPreviewComparisonFixture(linkEntrySource);
  comparisonPreview = await servePreviewFixture(comparisonFixture.output);
});

test.afterAll(async () => {
  await comparisonPreview?.close();
  await comparisonFixture?.close();
  await preview?.close();
});

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: published design states and styled buttons use the same navigation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(`${preview.url}/view/design/browse/views/home`);
    await chooseViewport(page, viewport);
    await expect(page.locator("html")).toHaveAttribute(
      "data-mokly-hydrated",
      "",
    );
    await expect(page.locator(`.mbk-frame-${viewport} iframe`)).toHaveAttribute(
      "data-mokly-frame-state",
      "ready",
    );
    const frame = page.frameLocator(`.mbk-frame-${viewport} iframe`);
    await frame.locator(".mbk-empty-link").click();
    await expect(page).toHaveURL(/\/view\/design\/browse\/views\/screen$/);
    await frame.locator(".mbk-shot-link").first().click();
    await expect(page).toHaveURL(
      /\/view\/design\/browse\/views\/details-screen$/,
    );
    await expect(
      page.locator('a[data-route="design/browse/views/details-screen.html"]'),
    ).toHaveAttribute("aria-current", "page");
    await frame.locator(".mbk-shot-link").first().click();
    await expect(page).toHaveURL(/\/view\/design\/browse\/views\/screen$/);
    await frame.locator(".mbk-search-tag").click();
    await expect(page).toHaveURL(
      /\/view\/design\/browse\/states\/tags\/picker$/,
    );
    await frame
      .getByRole("group", { name: "Tags", exact: true })
      .getByRole("link", { name: "onboarding", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/view\/design\/browse\/states\/tags\/onboarding$/,
    );
    await frame.locator(".mbk-search-tag").click();
    await expect(page).toHaveURL(
      /\/view\/design\/browse\/states\/tags\/onboarding-picker$/,
    );
    await frame
      .getByRole("group", { name: "Tags", exact: true })
      .getByRole("link", { name: "onboarding", exact: true })
      .click();
    await expect(page).toHaveURL(/\/view\/design\/browse\/views\/screen$/);
    await page.goto(`${preview.url}/id/design-page-view`);
    await frame.locator(".ce-inspector-link").click();
    await expect(page).toHaveURL(/\/view\/design\/browse\/pages\/details$/);
    await frame.locator(".ce-inspector-link").click();
    await frame
      .getByRole("link", { name: "Open Welcome", exact: true })
      .click();
    await expect(page).toHaveURL(/\/view\/design\/browse\/views\/screen$/);
    await page.goto(`${preview.url}/view/screens/welcome`);
    await chooseScheme(page, "dark");
    await frame
      .getByRole("link", { name: "View details", exact: true })
      .click();
    await expect(page).toHaveURL(/\/view\/screens\/details\?fragment=details$/);
    await expectFrameSource(
      page.locator(`.mbk-frame-${viewport} iframe`),
      /\.dark(?:\.html)?#details$/,
    );
    const back = frame
      .locator('a[data-mokly-link-control="button"]')
      .filter({ hasText: "Return to welcome" });
    await focusDesignLink(back);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/view\/screens\/welcome$/);
  });

  test(`${viewport}: published comparison links stay inside the isolated current snapshot`, async ({
    page,
  }) => {
    await page.goto(`${comparisonPreview.url}/view/screens/home`);
    await chooseViewport(page, viewport);
    await page
      .getByRole("button", { name: "Side by side", exact: true })
      .click();
    const iframe = page.locator("[data-diff-stage] iframe").last();
    await expect(iframe).toHaveAttribute("sandbox", "");
    const frame = iframe.contentFrame();
    const next = frame.getByRole("link", { name: "View details", exact: true });
    await expect(next).toHaveAttribute(
      "href",
      `./details.${viewport}.html#details`,
    );
    const snapshot = await (await iframe.elementHandle())?.contentFrame();
    if (!snapshot) throw new Error("The current snapshot frame is missing");
    await snapshot.waitForLoadState("load");
    await iframe.scrollIntoViewIfNeeded();
    await Promise.all([
      snapshot.waitForURL(
        new RegExp(`/details\\.${viewport}(?:\\.html)?#details$`),
        { waitUntil: "load" },
      ),
      next.click(),
    ]);
    await expect(page).toHaveURL(`${comparisonPreview.url}/view/screens/home`);
    await expect(frame.locator("main#details")).toBeVisible();
    await Promise.all([
      snapshot.waitForURL(new RegExp(`/home\\.${viewport}(?:\\.html)?$`), {
        waitUntil: "load",
      }),
      frame.getByRole("link", { name: "Return home", exact: true }).click(),
    ]);
    await expect(frame.locator("h1")).toHaveText("Current home");
    await expect(page.locator("#mb-main h2")).toHaveText("Home");
  });
}

function linkEntrySource(changed: boolean): string {
  const source = validEntrySource({
    body: `<h1>${changed ? "Current" : "Previous"} home</h1><a href="mock:details#details">View details</a>`,
  });
  const details =
    '<main id="details"><h1>Details</h1><a href="mock:home">Return home</a></main>';
  return source
    .replace('<main id="details">Detail</main>', details)
    .replace('<main id="details-mobile">Detail</main>', details);
}

async function generatedDigest(): Promise<string> {
  const root = path.join(repositoryRoot, "examples/basic/generated");
  const hash = crypto.createHash("sha256");
  for (const relative of (await fs.readdir(root, { recursive: true })).sort()) {
    const file = path.join(root, relative);
    if ((await fs.stat(file)).isFile()) {
      hash.update(relative);
      hash.update(await fs.readFile(file));
    }
  }
  return hash.digest("hex");
}
