import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { serveChanges } from "./serve_changes_fixture.js";

test("native CSS evidence shares the published base and selected generations reject unsafe routes", async ({
  page,
}) => {
  const fixture = await serveChanges();
  try {
    const index = await fixture.index();
    const review = await (
      await page.request.get(`${fixture.url}/${index.comparisonUrl}`)
    ).json();
    const detail = await (
      await page.request.get(`${fixture.url}/mokly-viewer/entries/sample.json`)
    ).json();
    expect(detail.revision).toBe(index.revision);
    expect(detail.reasons).toEqual(
      review.entries.find((entry: { path: string }) => entry.path === "sample")
        .reasons,
    );
    const unchanged = await (
      await page.request.get(`${fixture.url}/mokly-viewer/entries/stable.json`)
    ).json();
    expect(unchanged).not.toHaveProperty("reasons");
    const removed = await (
      await page.request.get(
        `${fixture.url}/${index.comparisonUrl!.replace("review.json", "entries/removed.json")}`,
      )
    ).json();
    expect(removed.reasons).toEqual([{ kind: "removed" }]);
    expect(detail.views[0].resourceEvidence.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "matched",
          owner: { kind: "entry" },
        }),
      ]),
    );
    const selected = await page.request.get(
      `${fixture.url}/mokly-viewer/diffs/review.json?path=sample`,
    );
    expect(selected.url()).toMatch(/\/selected-[a-f0-9-]+\/review\.json$/);
    const body = await selected.json();
    expect(body.schemaVersion).toBe(8);
    expect(body.baseCommit).toBe(review.baseCommit);
    expect(body.entries.map((entry: { path: string }) => entry.path)).toEqual([
      "sample",
    ]);
    expect(body.entries[0].views[0].rules).toEqual(
      detail.views[0].resourceEvidence.rules,
    );
    expect(body.affected).toEqual([]);
    expect(body.diagnostics).toEqual([]);
    const head = await page.request.head(selected.url());
    expect(head.ok()).toBe(true);
    expect(head.headers()["cache-control"]).toBe("no-store");
    expect(head.headers()["x-content-type-options"]).toBe("nosniff");
    expect((await head.body()).length).toBe(0);
    for (const suffix of [
      "snapshots/after/mokly.config.json",
      "snapshots/after/mokly-generated/removed/index.mobile.html",
      "entries/sample.json",
    ]) {
      expect(
        (
          await page.request.get(selected.url().replace("review.json", suffix))
        ).status(),
      ).toBe(404);
    }
    for (const query of [
      "path=../sample",
      "path=sample&path=stable",
      "path=sample&variant=x",
      "path=sample&refresh=0",
    ]) {
      expect(
        (
          await page.request.get(
            `${fixture.url}/mokly-viewer/diffs/review.json?${query}`,
          )
        ).status(),
      ).toBe(400);
    }
    expect(
      (
        await page.request.get(
          `${fixture.url}/mokly-viewer/diffs/generations/missing/review.json`,
        )
      ).status(),
    ).toBe(404);
    await page.goto(`${fixture.url}/view/sample/`);
    await page.getByRole("tab", { name: "Details", exact: true }).click();
    await expect(
      page.getByRole("tabpanel", { name: "Details", exact: true }),
    ).toContainText("theme.css");
  } finally {
    await fixture.close();
  }
});
