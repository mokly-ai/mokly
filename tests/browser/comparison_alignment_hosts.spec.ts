import { expect, test, type Locator, type Page } from "@playwright/test";

import { comparisonAlignmentExport } from "../helpers/comparison_alignment_fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { expectPresentedPane, PANE_SOURCE } from "./comparison_actions.js";
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
} from "./comparison_alignment_helpers.js";
import { hostExportedViewer, type HostedViewer } from "./viewer_host.js";

let exported: Awaited<ReturnType<typeof comparisonAlignmentExport>>;
let site: Awaited<ReturnType<typeof serveStaticFiles>>;
let viewer: HostedViewer;

test.describe.configure({ timeout: 90_000 });
test.beforeAll(async () => {
  test.setTimeout(240_000);
  exported = await comparisonAlignmentExport();
  site = await serveStaticFiles(exported.output);
  viewer = await hostExportedViewer(exported.output);
});
test.afterAll(async () => {
  await viewer?.close();
  await site?.close();
  await exported?.close();
});

/** Both versions and every shared viewport of a section at one offset. */
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

/** Links and forms stay inert and an anchor moves every version. */
async function expectReadOnly(page: Page, section: Locator): Promise<void> {
  const address = page.url();
  const frame = paneFrame(section, "after");
  const source = await frame.getAttribute(PANE_SOURCE);
  const content = frame.contentFrame();
  await content.getByRole("link", { name: "Open short" }).click();
  await expect(content.locator("h1")).toHaveText("Current tall");
  await expect(frame).toHaveAttribute(PANE_SOURCE, source!);
  expect(page.url()).toBe(address);
  const target = await content
    .locator("#al-target")
    .evaluate(
      (node) =>
        node.getBoundingClientRect().top +
        node.ownerDocument.scrollingElement!.scrollTop,
    );
  await content.getByRole("link", { name: "Jump to target" }).click();
  await expectMirroredAt(section, target);
  expect(page.url()).toBe(address);
}

test("a static export aligns stacks, mirrors Side by side and stays read-only", async ({
  page,
}) => {
  await openComparison(
    page,
    `${site.url}/view/tall/`,
    "desktop",
    "Overlay",
    "static",
  );
  const desktop = comparisonSection(page, "desktop");
  for (const side of ["before", "after"] as const)
    await expectPresentedPane(
      paneFrame(desktop, side),
      /\/mokly-viewer\/diffs\/generations\/[a-f0-9]{64}\/snapshots\//,
    );
  await wheelOver(page, paneFrame(desktop, "after"), 400);
  await expectStackAt(desktop, 400);
  await expectCoincidentLayers(desktop);
  await page.getByRole("button", { name: "Side by side", exact: true }).click();
  await expect(sharedViewports(desktop)).toHaveCount(2);
  await wheelOver(page, paneFrame(desktop, "before"), 300);
  await expectMirroredAt(desktop, 300);
  await wheelOver(page, paneFrame(desktop, "before"), -300);
  await expectMirroredAt(desktop, 0);
  await expectReadOnly(page, desktop);
});

for (const adapter of ["same-origin", "cross"] as const)
  test(`an embedded viewer aligns comparisons through the ${adapter} adapter`, async ({
    page,
  }) => {
    await openComparison(
      page,
      `${viewer.url}/viewer.html?adapter=${adapter}&entry=tall`,
      "desktop",
      "Overlay",
      "static",
    );
    const desktop = comparisonSection(page, "desktop");
    await expectPresentedPane(paneFrame(desktop, "after"));
    await wheelOver(page, paneFrame(desktop, "after"), 400);
    await expectStackAt(desktop, 400);
    await expectCoincidentLayers(desktop);
    await wheelOver(page, paneFrame(desktop, "after"), -400);
    await expectStackAt(desktop, 0);
    await expectReadOnly(page, desktop);
  });

test("a pane document that cannot be presented fails and recovers with Try again", async ({
  page,
}) => {
  let failing = true;
  await page.route(
    "**/snapshots/after/mokly-generated/tall/index.desktop.html",
    (route) =>
      failing
        ? route.fulfill({
            status: 404,
            contentType: "text/plain",
            body: "gone",
          })
        : route.continue(),
  );
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`${viewer.url}/viewer.html?adapter=cross&entry=tall`);
  await page.getByLabel("Viewport", { exact: true }).selectOption("desktop");
  await page.getByRole("button", { name: "Overlay", exact: true }).click();
  const stage = page.locator("[data-diff-stage]");
  await expect(stage).toContainText("The comparison could not be loaded.");
  await expect(stage.locator("[data-comparison-failure] p")).toHaveText(
    "The comparison is unavailable.",
  );
  await expect(stage.locator("iframe")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { viewerErrors: { code: string }[] })
            .viewerErrors,
      ),
    )
    .toContainEqual({
      code: "comparison",
      message: "The comparison could not be loaded. Try again.",
    });
  failing = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  const desktop = comparisonSection(page, "desktop");
  await expect(
    paneFrame(desktop, "after").contentFrame().locator("h1"),
  ).toHaveText("Current tall");
  await expect(stage).not.toHaveAttribute("aria-busy", "true");
});
