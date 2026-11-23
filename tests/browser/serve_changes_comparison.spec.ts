import { expect } from "@playwright/test";

import { hasMarker, markPage } from "./browse_assertions.js";
import { test } from "./browser_test.js";
import { comparisonSection, paneFrame } from "./comparison_sections.js";
import { chooseMode, modeButton } from "./comparison_ui.js";
import { screen, serveChanges } from "./serve_changes_fixture.js";

test("native selected comparison keeps both sides and renews after a watched edit", async ({
  page,
}) => {
  const fixture = await serveChanges();
  try {
    await page.goto(`${fixture.url}/view/sample/`);
    await chooseMode(page, "Side by side");
    // Side by side compares the first shown frame, Desktop · Light.
    const pair = comparisonSection(page, "desktop");
    const before = paneFrame(pair, "before");
    const after = paneFrame(pair, "after");
    await expect(before).toHaveAttribute("title", "Before — desktop — light");
    await expect(after).toHaveAttribute("title", "Current — desktop — light");
    await expect(before.contentFrame().locator("p")).toHaveText(
      "Before sample",
    );
    await expect(after.contentFrame().locator("p")).toHaveText(
      "Current sample",
    );
    await expect(before.contentFrame().locator("p")).toHaveCSS(
      "color",
      "rgb(255, 0, 0)",
    );
    await expect(after.contentFrame().locator("p")).toHaveCSS(
      "color",
      "rgb(0, 0, 255)",
    );
    const source = await after.getAttribute("data-mokly-preview-source");
    const renewal = page.waitForRequest(
      (request) =>
        request.method() === "HEAD" && request.url().includes("/selected-"),
    );
    await chooseMode(page, "Overlay");
    await renewal;
    await markPage(page);
    const index = await fixture.index();
    await fixture.write(
      "specs/sample.screen.html",
      screen("Sample", "<p>Renewed sample</p>"),
    );
    await fixture.ready(index.revision);
    await expect(modeButton(page, "Current")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await hasMarker(page)).toBe(true);
    await chooseMode(page, "Side by side");
    await expect(after).toHaveAttribute("title", "Current — desktop — light");
    await expect(after.contentFrame().locator("p")).toHaveText(
      "Renewed sample",
    );
    expect(await after.getAttribute("data-mokly-preview-source")).not.toBe(
      source,
    );
    const retained = await page.request.get(source!);
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
      `${fixture.url}/mokly-viewer/diffs/selection?path=widget`,
    );
    expect(response.status()).toBe(204);
    expect(response.url()).toMatch(/\/generations\/selected-[^/]+\/$/u);
    const detail = await (
      await page.request.get(
        `${fixture.url}/${index.comparisonUrl!}entries/widget.json`,
      )
    ).json();
    expect(detail.entry).toEqual({
      kind: "component",
      path: "widget",
      snapshotId: removed.snapshotId,
    });
    expect(detail.reasons).toEqual([{ kind: "removed" }]);
    expect(detail.views.length).toBeGreaterThan(0);
    for (const view of detail.views) expect(view.state).toBe("removed");
    expect(detail.before).toBeUndefined();
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(
      `${fixture.url}/view/widget/?snapshot=${removed.snapshotId}`,
    );
    await chooseMode(page, "Side by side");
    // The removed component's frame compares its version before alone.
    const pair = comparisonSection(page, "component");
    await expect(paneFrame(pair, "before")).toHaveAttribute(
      "title",
      "Before — desktop — light",
    );
    await expect(
      paneFrame(pair, "before").contentFrame().locator("body"),
    ).toContainText("Historical widget");
    await expect(paneFrame(pair, "after")).toHaveCount(0);
    expect(
      requests.filter(
        (url) => new URL(url).pathname === "/mokly-viewer/diffs/selection",
      ),
    ).toEqual([]);
  } finally {
    await fixture.close();
  }
});
