import fs from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import { entryDetailPath } from "../../packages/viewer/src/catalogue/delivery_paths.js";
import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";
import type {} from "./viewer_harness.js";
import { canvasFrame } from "./workspace_actions.js";

declare global {
  interface Window {
    detailFailureProbe: { same: boolean };
  }
}

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture();
});
test.afterAll(async () => fixture?.close());

const failureText = /^The catalogue could not be loaded\s*Try again$/u;
const detailPath = entryDetailPath("home");

for (const field of ["views", "identity"] as const) {
  test(`an embedded detail with null ${field} fails the catalogue once and retries`, async ({
    page,
    allowBrowserError,
  }) => {
    const property = field === "views" ? "find" : "id";
    allowBrowserError({
      kind: "console",
      message: new RegExp(
        `Cannot read properties of null \\(reading '${property}'\\)[\\s\\S]*error boundary you provided, CatalogueBoundary\\.`,
        "u",
      ),
    });
    const filename = path.join(fixture.root, detailPath);
    const good = JSON.stringify(fixture.details.current["home"]);
    await fs.writeFile(
      filename,
      JSON.stringify({ ...fixture.details.current["home"], [field]: null }),
    );
    try {
      await page.goto(fixture.host.url);
      await page.waitForFunction(() => Boolean(window.viewerHarness));
      // The host supplies a malformed document through its real detail callback.
      await page.evaluate((detailPath) => {
        const host = window.viewerHarness.start("one");
        host.props.detail = () => new URL(detailPath, location.href);
        host.render();
      }, detailPath);
      const failure = page.locator("#one").getByRole("alert");
      await expect(failure).toHaveText(failureText);
      await expect(
        page.getByRole("navigation", { name: "Catalogue" }),
      ).toHaveCount(0);
      await fs.writeFile(filename, good);
      await failure.getByRole("button", { name: "Try again" }).click();
      await expect(
        page.getByRole("heading", { name: "Home", exact: true }),
      ).toBeVisible();
      await expect(
        page
          .locator(canvasFrame("mobile"))
          .contentFrame()
          .getByRole("button", { name: "Visible", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(() =>
          window.viewerHarness
            .get("one")
            .events.filter((event) => event.name === "error")
            .map((event) => event.value),
        ),
      ).toEqual([
        {
          code: "catalogue",
          message: "The catalogue could not be loaded. Try again.",
        },
      ]);
    } finally {
      await fs.writeFile(filename, good);
    }
  });

  test(`a standalone detail with null ${field} fails the catalogue and retries`, async ({
    page,
    allowBrowserError,
  }) => {
    const property = field === "views" ? "find" : "id";
    allowBrowserError({
      kind: "console",
      message: new RegExp(
        `^TypeError: Cannot read properties of null \\(reading '${property}'\\)`,
        "u",
      ),
    });
    const filename = path.join(fixture.root, detailPath);
    const good = JSON.stringify(fixture.details.current["home"]);
    await fs.writeFile(
      filename,
      JSON.stringify({ ...fixture.details.current["home"], [field]: null }),
    );
    try {
      await page.goto(`${fixture.host.url}/view/home/`);
      const failure = page.getByRole("alert");
      await expect(failure).toHaveText(failureText);
      await expect(
        page.getByRole("navigation", { name: "Catalogue" }),
      ).toHaveCount(0);
      await fs.writeFile(filename, good);
      await failure.getByRole("button", { name: "Try again" }).click();
      await expect(
        page.getByRole("heading", { name: "Home", exact: true }),
      ).toBeVisible();
      await expect(
        page
          .locator(canvasFrame("mobile"))
          .contentFrame()
          .getByRole("button", { name: "Visible", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Catalogue" }),
      ).toBeVisible();
    } finally {
      await fs.writeFile(filename, good);
    }
  });
}

test("a host error callback that throws after a detail transport failure reaches the host unchanged", async ({
  page,
  allowBrowserError,
}) => {
  allowBrowserError({
    kind: "pageerror",
    message: /^Host detail error callback failed$/u,
  });
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  // The host observes the exact rejected value from its own error callback.
  await page.evaluate(() => {
    const host = window.viewerHarness.start("one");
    const error = new Error("Host detail error callback failed");
    const report = host.props.onError!;
    window.detailFailureProbe = { same: false };
    window.addEventListener("unhandledrejection", (event) => {
      if (event.reason === error) window.detailFailureProbe.same = true;
    });
    host.props.detail = () => {
      throw new Error("Host detail transport failed");
    };
    host.props.onError = (event) => {
      report(event);
      throw error;
    };
    host.render();
  });
  await expect
    .poll(() => page.evaluate(() => window.detailFailureProbe.same))
    .toBe(true);
  await expect(
    page.getByRole("navigation", { name: "Catalogue" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "error")
        .map((event) => event.value),
    ),
  ).toEqual([
    {
      code: "catalogue",
      message: "This entry could not be loaded. Try again.",
    },
  ]);
});
