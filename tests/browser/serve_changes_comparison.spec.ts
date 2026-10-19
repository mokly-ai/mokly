import { expect } from "@playwright/test";

import { hasMarker, markPage } from "./browse_assertions.js";
import { test } from "./browser_test.js";
import { screen, serveChanges } from "./serve_changes_fixture.js";

test("native selected comparison keeps both sides and renews after a watched edit", async ({
  page,
}) => {
  const fixture = await serveChanges();
  try {
    await page.goto(`${fixture.url}/view/sample/`);
    await page.locator('[data-diff-mode="side"]').click();
    await expect(
      page
        .frameLocator(
          '.mb-pane--before iframe[title="Before — desktop — light"]',
        )
        .locator("p"),
    ).toHaveText("Before sample");
    await expect(
      page
        .frameLocator(
          '.mb-pane--after iframe[title="Current — desktop — light"]',
        )
        .locator("p"),
    ).toHaveText("Current sample");
    await expect(
      page
        .frameLocator(
          '.mb-pane--before iframe[title="Before — desktop — light"]',
        )
        .locator("p"),
    ).toHaveCSS("color", "rgb(255, 0, 0)");
    await expect(
      page
        .frameLocator(
          '.mb-pane--after iframe[title="Current — desktop — light"]',
        )
        .locator("p"),
    ).toHaveCSS("color", "rgb(0, 0, 255)");
    const before = await page
      .locator('.mb-pane--after iframe[title="Current — desktop — light"]')
      .getAttribute("data-mokly-preview-source");
    const renewal = page.waitForRequest(
      (request) =>
        request.method() === "HEAD" && request.url().includes("/selected-"),
    );
    await page.locator('[data-diff-mode="overlay"]').click();
    await renewal;
    await markPage(page);
    const index = await fixture.index();
    await fixture.write(
      "specs/sample.screen.html",
      screen("Sample", "<p>Renewed sample</p>"),
    );
    await fixture.ready(index.revision);
    await expect(page.locator('[data-diff-mode="current"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await hasMarker(page)).toBe(true);
    await page.locator('[data-diff-mode="side"]').click();
    await expect(
      page
        .frameLocator(
          '.mb-pane--after iframe[title="Current — desktop — light"]',
        )
        .locator("p"),
    ).toHaveText("Renewed sample");
    expect(
      await page
        .locator('.mb-pane--after iframe[title="Current — desktop — light"]')
        .getAttribute("data-mokly-preview-source"),
    ).not.toBe(before);
    const retained = await page.request.get(before!);
    expect(retained.ok()).toBe(true);
    expect(await retained.text()).toContain("Current sample");
  } finally {
    await fixture.close();
  }
});

test("a removed native component opens a comparison with only its before side", async ({
  page,
}) => {
  const fixture = await serveChanges({ removedComponent: true });
  try {
    const index = await fixture.index();
    const removed = index.removedEntries.find(
      ({ entry }) => entry.path === "widget",
    )!;
    expect(removed.entry.kind).toBe("component");
    expect(removed.preview).toBeUndefined();
    const response = await page.request.get(
      `${fixture.url}/mokly-viewer/diffs/review.json?path=widget`,
    );
    expect(response.ok()).toBe(true);
    const review = await response.json();
    expect(review.entries).toHaveLength(1);
    expect(review.entries[0].state).toBe("removed");
    expect(review.entries[0].before.path).toBe("widget");
    expect(review.entries[0].after).toBeUndefined();
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(
      `${fixture.url}/view/widget/?snapshot=${removed.snapshotId}`,
    );
    await page.locator('[data-diff-mode="side"]').click();
    await expect(
      page
        .frameLocator(
          '.mb-pane--before iframe[title="Before — desktop — light"]',
        )
        .first()
        .locator("body"),
    ).toContainText("Historical widget");
    await expect(
      page.locator('.mb-pane--after iframe[title="Current — desktop — light"]'),
    ).toHaveCount(0);
    expect(
      requests.filter(
        (url) => new URL(url).pathname === "/mokly-viewer/diffs/review.json",
      ),
    ).toEqual([]);
  } finally {
    await fixture.close();
  }
});
