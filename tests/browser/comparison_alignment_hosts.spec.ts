/**
 * Comparison panes outside Serve, under the comparison panes contract. On the
 * copied comparison output and in an embedded viewer through both frame
 * adapters, a stack scrolls as one, Side by side mirrors, each pane presents
 * its version as a script-free `srcdoc` document, links and forms do
 * nothing, and the anchor moves the shared viewports. A pane document that
 * cannot be presented fails the comparison with Try again, and Try again
 * presents it, in both hosts.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import {
  comparisonSection,
  expectCoincidentLayers,
  expectStackAt,
  layerOffsets,
  openComparison,
  paneFrame,
  sharedViewports,
  viewportOffset,
  wheelOver,
} from "./comparison_scroll.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { comparisonIndex, modeButton } from "./comparison_ui.js";
import {
  comparisonViewerHost,
  openEmbeddedComparison,
  type ComparisonViewerHost,
} from "./comparison_viewer_host.js";
import {
  blockedFormSubmission,
  responseFailure,
} from "./shell_error_allowances.js";
import { chooseViewport } from "./workspace_actions.js";

const changed = comparisonPaths.changed;
const DOCUMENT = `/snapshots/after/mokly-generated/${changed}/index.desktop.html`;

const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/** A pane presents its version as a script-free `srcdoc` document. */
async function expectPresentedPanes(section: Locator, origin: string) {
  for (const side of ["before", "after"] as const) {
    const frame = paneFrame(section, side);
    await expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
    await expect(frame).not.toHaveAttribute("src");
    await expect(frame).toHaveAttribute(
      "data-mokly-preview-source",
      new RegExp(
        `^${literal(origin)}/mokly-viewer/diffs/generations/[a-f0-9]{64}/snapshots/${side}/mokly-generated/${changed}/index\\.desktop\\.html$`,
        "u",
      ),
    );
    expect(
      await frame.evaluate(
        (element: HTMLIFrameElement) => element.contentDocument?.URL,
      ),
    ).toBe("about:srcdoc");
  }
}

/** Both versions and both shared viewports of Side by side at one offset. */
async function expectMirroredAt(section: Locator, y: number): Promise<void> {
  await expect
    .poll(async () => {
      const offsets = await layerOffsets(section);
      return [offsets.before.y, offsets.after.y];
    })
    .toEqual([y, y]);
  for (const viewport of await sharedViewports(section).all())
    await expect.poll(async () => (await viewportOffset(viewport)).y).toBe(y);
}

/** Links and forms do nothing; the anchor moves every shared viewport. */
async function expectReadOnly(page: Page, section: Locator): Promise<void> {
  const address = page.url();
  const frame = paneFrame(section, "after");
  const source = await frame.getAttribute("data-mokly-preview-source");
  const content = frame.contentFrame();
  await content
    .getByRole("link", { name: "Open the stable screen", exact: true })
    .click();
  await content.getByRole("button", { name: "Send", exact: true }).click();
  await expect(content.locator("h1")).toHaveText("After screen");
  await expect(frame).toHaveAttribute("data-mokly-preview-source", source!);
  expect(page.url()).toBe(address);
  const target = await content
    .locator("#end")
    .evaluate(
      (node) =>
        node.getBoundingClientRect().top +
        node.ownerDocument.scrollingElement!.scrollTop,
    );
  await content
    .getByRole("link", { name: "Jump to the end", exact: true })
    .click();
  for (const viewport of await sharedViewports(section).all())
    await expect
      .poll(async () => (await viewportOffset(viewport)).y)
      .toBeCloseTo(target, 0);
  expect(page.url()).toBe(address);
}

test("a static export aligns stacks, mirrors Side by side and stays read-only", async ({
  page,
  baseURL,
  allowBrowserError,
}) => {
  allowBrowserError(blockedFormSubmission);
  await openComparison(page, changed, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  await expectPresentedPanes(desktop, baseURL!);
  await wheelOver(page, paneFrame(desktop, "after"), 400);
  await expectStackAt(desktop, 400);
  await expectCoincidentLayers(desktop);
  await modeButton(page, "Side by side").click();
  await expect(sharedViewports(desktop)).toHaveCount(2);
  await wheelOver(page, paneFrame(desktop, "before"), 300);
  await expectMirroredAt(desktop, 300);
  await wheelOver(page, paneFrame(desktop, "before"), -300);
  await expectMirroredAt(desktop, 0);
  await expectReadOnly(page, desktop);
});

test("a pane document that cannot be presented fails and recovers with Try again", async ({
  page,
  request,
  baseURL,
  allowBrowserError,
}) => {
  const index = await comparisonIndex(request, baseURL);
  const generation = index.comparisonUrl.replace(/review\.json$/u, "");
  const document = `/${generation}${DOCUMENT.slice(1)}`;
  // The host answers the current version's pane document with 404 once.
  allowBrowserError(responseFailure(baseURL!, document, 404));
  let failing = true;
  await page.route(`**${document}`, (route) =>
    failing
      ? route.fulfill({ status: 404, contentType: "text/plain", body: "gone" })
      : route.continue(),
  );
  await page.goto(`/view/${changed}/`);
  await chooseViewport(page, "desktop");
  await modeButton(page, "Overlay").click();
  await expectFailedThenPresented(page, () => {
    failing = false;
  });
});

/** The failure state, then Try again presents both versions. */
async function expectFailedThenPresented(page: Page, recover: () => void) {
  const stage = page.locator("[data-diff-stage]");
  await expect(stage).toContainText("The comparison could not be loaded.");
  await expect(stage.locator("[data-comparison-failure] p")).toHaveText(
    "The comparison is unavailable.",
  );
  await expect(stage.locator("iframe")).toHaveCount(0);
  await expect(modeButton(page, "Overlay")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  recover();
  await stage.getByRole("button", { name: "Try again", exact: true }).click();
  const desktop = comparisonSection(page, "desktop");
  await expect(
    paneFrame(desktop, "after").contentFrame().locator("h1"),
  ).toHaveText("After screen");
  await expect(
    paneFrame(desktop, "before").contentFrame().locator("h1"),
  ).toHaveText("Before screen");
  await expect(stage).not.toHaveAttribute("aria-busy", "true");
  await expect(stage.locator("[data-comparison-failure]")).toHaveCount(0);
}

test.describe("embedded viewer", () => {
  let host: ComparisonViewerHost;
  test.beforeAll(async () => {
    host = await comparisonViewerHost();
  });
  test.afterAll(async () => {
    await host?.close();
  });

  for (const adapter of ["same-origin", "cross"] as const)
    test(`an embedded viewer aligns comparisons through the ${adapter} adapter`, async ({
      page,
      allowBrowserError,
    }) => {
      allowBrowserError(blockedFormSubmission);
      await openEmbeddedComparison(
        page,
        `${host.url}/viewer.html?adapter=${adapter}&entry=${changed}`,
        "desktop",
        "Overlay",
      );
      const desktop = comparisonSection(page, "desktop");
      await expectPresentedPanes(
        desktop,
        adapter === "cross" ? host.frameOrigin : host.url,
      );
      await wheelOver(page, paneFrame(desktop, "after"), 400);
      await expectStackAt(desktop, 400);
      await expectCoincidentLayers(desktop);
      await wheelOver(page, paneFrame(desktop, "after"), -400);
      await expectStackAt(desktop, 0);
      await expectReadOnly(page, desktop);
    });

  test("an embedded pane document that cannot be presented fails, reports, and recovers", async ({
    page,
    allowBrowserError,
  }) => {
    let failing = true;
    await page.route(`**/generations/*${DOCUMENT}`, async (route) => {
      if (!failing) return route.continue();
      allowBrowserError(
        responseFailure(
          host.frameOrigin,
          new URL(route.request().url()).pathname,
          404,
        ),
      );
      return route.fulfill({
        status: 404,
        contentType: "text/plain",
        body: "gone",
      });
    });
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(`${host.url}/viewer.html?adapter=cross&entry=${changed}`);
    await chooseViewport(page, "desktop");
    await modeButton(page, "Overlay").click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { viewerErrors: { code: string }[] })
              .viewerErrors,
        ),
      )
      .toContainEqual(expect.objectContaining({ code: "comparison" }));
    await expectFailedThenPresented(page, () => {
      failing = false;
    });
  });
});
