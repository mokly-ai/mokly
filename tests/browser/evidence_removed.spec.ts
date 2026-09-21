import fs from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { loadConfig } from "../../dist/config/load.js";
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
      defineScreen({ ...metadata, id: "old-screen", title: "Old screen", description: "Previous screen",
        route: "removed/z-screen.html", mobile: <main>Previous</main>, desktop: <main>Previous</main>, useCaseIds: [] }),
      definePage({ ...metadata, id: "old-page", title: "Old page", description: "Previous document",
        route: "removed/m-page.html", render: () => "<!doctype html><html><head></head><body>Previous document</body></html>" }),
      defineComponent({ ...metadata, id: "old-component", title: "Old component", description: "Previous component",
        route: "removed/a-component.html", propSchema: { kind: "object", properties: {} },
        render: () => <button>Previous</button>, variants: [{ id: "default", title: "Default", props: {} }] }).entry
    );
  `,
  );
  const { server } = fixture;
  try {
    const { manifest: baseline } = await compileCatalogue(
      await loadConfig(before.root),
    );
    const routes = [
      "removed/a-component.html",
      "removed/m-page.html",
      "removed/z-screen.html",
    ];
    const publish = (entries = baseline.entries) =>
      server.publishUpdate({
        kind: "evidence",
        changesStatus: "ready",
        changedRoutes: routes,
        componentChanges: {
          baseline: { ...baseline, entries },
          changedRoutes: routes,
        },
      });
    await page.goto(`${server.url}/view/screens/home.html`);
    await page
      .locator("html")
      .evaluate((root) => root.setAttribute("data-test-retained", "true"));
    const removed = page.locator("a[data-nav-removed]");
    const screen = page.locator('a[data-route="removed/z-screen.html"]');
    const document = page.locator('a[data-route="removed/m-page.html"]');
    const component = page.locator('a[data-route="removed/a-component.html"]');
    publish(baseline.entries.filter((entry) => entry.id !== "old-component"));
    await expect(removed).toHaveCount(2);
    await expect(screen).toBeVisible();
    await expect(document).toBeHidden();
    const retained = await screen.elementHandle();
    publish();
    await expect(removed).toHaveCount(3);
    await expect(
      page.locator(
        '[data-nav-section="pages"] a[data-route="removed/z-screen.html"]',
      ),
    ).toHaveCount(1);
    await expect(
      page.locator(
        '[data-nav-section="pages"] a[data-route="removed/m-page.html"]',
      ),
    ).toHaveCount(1);
    await expect(
      page.locator(
        '[data-nav-section="components"] a[data-route="removed/a-component.html"]',
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
      "removed/m-page.html",
      "removed/z-screen.html",
      "removed/a-component.html",
    ]);
    expect(await retained!.evaluate((row) => row.isConnected)).toBe(true);
    await expect(component).toBeVisible();
    await expect(document).toBeHidden();
    await expect(page.locator("html")).toHaveAttribute(
      "data-test-retained",
      "true",
    );
    const source = await fs.readFile(before.entryPath, "utf8");
    await fs.writeFile(
      before.entryPath,
      source
        .replaceAll("removed/z-screen.html", "removed/m-page.html")
        .replace(
          'route: "removed/m-page.html", render:',
          'route: "removed/z-screen.html", render:',
        ),
    );
    const switched = await compileCatalogue(await loadConfig(before.root));
    publish(switched.manifest.entries);
    await expect(screen).toContainText("Old page");
    await expect(screen).toBeHidden();
    await expect(document).toBeVisible();
    expect(await retained!.evaluate((row) => row.isConnected)).toBe(true);
    publish();
    await expect(screen).toContainText("Old screen");
    await expect(screen).toBeVisible();
    await expect(document).toBeHidden();
    await page.locator('[data-filter="changed"]').click();
    await expect(document).toBeVisible();
    expect(fixture.comparisonRequests).toBe(0);
    await document.click();
    await expect(
      page.getByRole("heading", { name: "Old page", exact: true }),
    ).toBeVisible();
    await expect.poll(() => fixture.comparisonRequests).toBeGreaterThan(0);
    const initialPreviewRequests = fixture.comparisonRequests;
    publish(
      baseline.entries.map((entry) =>
        entry.id === "old-page" ? { ...entry, title: "Earlier page" } : entry,
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
      .poll(() => fixture.comparisonRequests)
      .toBeGreaterThan(initialPreviewRequests);
    const previewRequests = fixture.comparisonRequests;
    await page.goto(`${server.url}/view/screens/home.html`);
    server.publishUpdate({
      kind: "evidence",
      changedRoutes: [],
      componentChanges: null,
      changesStatus: "pending",
    });
    await expect(removed).toHaveCount(0);
    await expect(page.locator('[data-nav-section="components"]')).toHaveCount(
      0,
    );
    expect(fixture.comparisonRequests).toBe(previewRequests);
  } finally {
    await fixture.close();
    await removeFixture(before);
  }
});
