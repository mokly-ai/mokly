import { expect, test } from "@playwright/test";

import { compileCatalogue } from "../../packages/mokly/dist/build/compile.js";
import { loadConfig } from "../../packages/mokly/dist/config/load.js";
import { startEvidenceFixture } from "../helpers/evidence_fixture.js";
import {
  createFixture,
  removeFixture,
  reparentedEntrySource,
} from "../helpers/fixture.js";

test("background baselines reconcile removed rows and invalidate changed historical views", async ({
  page,
}) => {
  const fixture = await startEvidenceFixture();
  const before = await createFixture(
    reparentedEntrySource("screens") +
      `
    import { defineComponent, definePage } from "@mokly/mokly";
    mockups.push(
      defineScreen({ ...metadata, path: "old-screen", title: "Old screen", description: "Previous screen",
        mobile: <main>Previous</main>, desktop: <main>Previous</main>, useCasePaths: [] }),
      definePage({ ...metadata, path: "old-page", title: "Old page", description: "Previous document",
        render: () => "<!doctype html><html><head></head><body>Previous document</body></html>" }),
      ...defineComponent({ ...metadata, path: "old-component", title: "Old component", description: "Previous component",
        propSchema: { kind: "object", properties: {} },
        render: () => <button>Previous</button>, variants: [{ slug: "default",  title: "Default", props: {} }] }).entries
    );
  `,
  );
  const { server } = fixture;
  let previewRequests = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.pathname === "/__mokly/diffs/review.json" &&
      url.searchParams.has("page")
    )
      previewRequests++;
  });
  try {
    const { manifest: baseline } = await compileCatalogue(
      await loadConfig(before.root),
    );
    const changedEntries = [
      "old-component",
      "old-component/default",
      "old-page",
      "old-screen",
    ];
    const publish = (entries = baseline.entries) =>
      server.publishUpdate({
        kind: "evidence",
        changesStatus: "ready",
        changedEntries,
        componentChanges: {
          baseline: { ...baseline, entries },
          changedEntries,
        },
      });
    await page.goto(`${server.url}/view/fixture/screens/home/`);
    await page
      .locator("html")
      .evaluate((root) => root.setAttribute("data-test-retained", "true"));
    const removed = page.locator("a[data-nav-removed]");
    const screen = page.locator('a[data-route="old-screen/index.html"]');
    const document = page.locator('a[data-route="old-page/index.html"]');
    const component = page.locator('a[data-route="old-component/index.html"]');
    publish(
      baseline.entries.filter(
        (entry) =>
          entry.path !== "old-component" &&
          (!("variantOf" in entry) || entry.variantOf !== "old-component"),
      ),
    );
    await expect(removed).toHaveCount(2);
    await expect(screen).toBeVisible();
    await expect(document).toBeHidden();
    const retained = await screen.elementHandle();
    publish();
    await expect(removed).toHaveCount(4);
    await expect(
      page.locator(
        '[data-nav-section="specs"] a[data-route="old-screen/index.html"]',
      ),
    ).toHaveCount(1);
    await expect(
      page.locator(
        '[data-nav-section="specs"] a[data-route="old-page/index.html"]',
      ),
    ).toHaveCount(1);
    await expect(
      page.locator(
        '[data-nav-section="components"] a[data-route="old-component/index.html"]',
      ),
    ).toHaveCount(1);
    await expect(
      page.locator("[data-mokly-nav-scroll] > a[data-nav-removed]"),
    ).toHaveCount(0);
    expect(
      await removed.evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-route")),
      ),
    ).toEqual([
      "old-page/index.html",
      "old-screen/index.html",
      "old-component/index.html",
      "old-component/default/index.html",
    ]);
    expect(await retained!.evaluate((row) => row.isConnected)).toBe(true);
    await expect(component).toBeVisible();
    await expect(document).toBeHidden();
    await expect(page.locator("html")).toHaveAttribute(
      "data-test-retained",
      "true",
    );
    await page.locator('[data-filter="changed"]').click();
    await expect(document).toBeVisible();
    expect(previewRequests).toBe(0);
    await document.click();
    await expect(
      page.getByRole("heading", { name: "Old page", exact: true }),
    ).toBeVisible();
    await expect.poll(() => previewRequests).toBeGreaterThan(0);
    const initialPreviewRequests = previewRequests;
    publish(
      baseline.entries.map((entry) =>
        entry.path === "old-page" ? { ...entry, title: "Earlier page" } : entry,
      ),
    );
    await expect(
      page.getByRole("heading", { name: "Earlier page", exact: true }),
    ).toBeVisible();
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-test-retained",
      "true",
    );
    await expect
      .poll(() => previewRequests)
      .toBeGreaterThan(initialPreviewRequests);
    const settledPreviewRequests = previewRequests;
    await page.goto(`${server.url}/view/fixture/screens/home/`);
    server.publishUpdate({
      kind: "evidence",
      changedEntries: [],
      componentChanges: null,
      changesStatus: "pending",
    });
    await expect(removed).toHaveCount(0);
    await expect(page.locator('[data-nav-section="components"]')).toHaveCount(
      0,
    );
    expect(previewRequests).toBe(settledPreviewRequests);
  } finally {
    await fixture.close();
    await removeFixture(before);
  }
});
