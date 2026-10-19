/**
 * Read-only comparison panes in the copied comparison output, under the
 * comparison panes contract. In each viewport, a catalogue link and a form
 * in the Current pane do nothing: the shell address, the pane document, and
 * its source stay. A same-document anchor still moves both shared viewports
 * to one offset, and each version to that offset or its own end.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import {
  comparisonSection,
  documentExtent,
  layerOffsets,
  openComparison,
  paneFrame,
  sharedViewports,
  viewportOffset,
} from "./comparison_scroll.js";
import { comparisonPaths, test } from "./comparison_test.js";

/** The sandbox reports the one form submission that it blocks. */
const BLOCKED_FORM = {
  kind: "console",
  message:
    /^Blocked form submission to 'https:\/\/example\.com\/form' because the form's frame is sandboxed and the 'allow-forms' permission is not set\.$/u,
  url: /^about:srcdoc$/u,
} as const;

/** Mark the pane's window, so that a replaced document is seen. */
async function markPane(frame: Locator): Promise<void> {
  await frame.evaluate((element: HTMLIFrameElement) =>
    Object.assign(element.contentWindow!, { keptPane: true }),
  );
}

async function expectPresentation(
  page: Page,
  frame: Locator,
  address: string,
  source: string,
): Promise<void> {
  await expect(page).toHaveURL(address);
  await expect(page.locator("#mb-main h2").first()).toHaveText(
    "Changed screen",
  );
  await expect(frame.contentFrame().locator("h1")).toHaveText("After screen");
  await expect(frame).toHaveAttribute("data-mokly-preview-source", source);
  expect(
    await frame.evaluate((element: HTMLIFrameElement) => [
      element.contentDocument?.URL,
      (element.contentWindow as { keptPane?: boolean } | null)?.keptPane,
    ]),
  ).toEqual(["about:srcdoc", true]);
}

for (const viewport of ["desktop", "mobile"] as const)
  test(`${viewport}: copied comparison panes stay read-only`, async ({
    page,
    allowBrowserError,
  }) => {
    allowBrowserError(BLOCKED_FORM);
    await openComparison(
      page,
      comparisonPaths.changed,
      viewport,
      "Side by side",
    );
    const section = comparisonSection(page, viewport);
    const frame = paneFrame(section, "after");
    const source = (await frame.getAttribute("data-mokly-preview-source"))!;
    const address = page.url();
    const document = frame.contentFrame();
    const away = document.getByRole("link", {
      name: "Open the stable screen",
      exact: true,
    });
    await expect(away).toHaveAttribute(
      "href",
      `../stable/index.${viewport}.html`,
    );
    await markPane(frame);
    await away.click();
    await expectPresentation(page, frame, address, source);
    await document.getByRole("button", { name: "Send", exact: true }).click();
    await expectPresentation(page, frame, address, source);

    const viewports = sharedViewports(section);
    await expect(viewports).toHaveCount(2);
    await document
      .getByRole("link", { name: "Jump to the end", exact: true })
      .click();
    await expect
      .poll(async () => (await viewportOffset(viewports.last())).y)
      .toBeGreaterThan(0);
    const shared = (await viewportOffset(viewports.last())).y;
    expect((await viewportOffset(viewports.first())).y).toBe(shared);
    // The Before page is shorter, so it may stop at its own end.
    const end = (await documentExtent(paneFrame(section, "before"))).range;
    const offsets = await layerOffsets(section);
    expect([offsets.before.y, offsets.after.y]).toEqual([
      Math.min(shared, end),
      shared,
    ]);
    await expectPresentation(page, frame, address, source);
  });
