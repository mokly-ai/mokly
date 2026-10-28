import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { serveChanges } from "./serve_changes_fixture.js";

test("native CSS evidence shares the published base and selected generations reject unsafe routes", async ({
  page,
}) => {
  const fixture = await serveChanges();
  try {
    const index = await fixture.index();
    expect(index.baseCommit).toMatch(/^[a-f0-9]{40}$/u);
    const detail = await (
      await page.request.get(`${fixture.url}/mokly-viewer/entries/sample.json`)
    ).json();
    expect(detail.revision).toBe(index.revision);
    expect(detail.reasons).toEqual(
      expect.arrayContaining([
        { kind: "material" },
        {
          kind: "dependency",
          path: expect.stringMatching(/theme\.css$/u),
        },
      ]),
    );
    expect(detail.views[0].state).toBe("changed");
    const unchanged = await (
      await page.request.get(`${fixture.url}/mokly-viewer/entries/stable.json`)
    ).json();
    expect(unchanged).not.toHaveProperty("reasons");
    const removed = await (
      await page.request.get(
        `${fixture.url}/${index.comparisonUrl!}entries/removed.json`,
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
      `${fixture.url}/mokly-viewer/diffs/selection?path=sample`,
    );
    // The selection redirects to its generation's root, which has no body.
    expect(selected.url()).toMatch(/\/selected-[a-f0-9-]+\/$/u);
    expect(selected.status()).toBe(204);
    expect((await selected.body()).length).toBe(0);
    const head = await page.request.head(selected.url());
    expect(head.status()).toBe(204);
    expect(head.headers()["cache-control"]).toBe("no-store");
    expect(head.headers()["x-content-type-options"]).toBe("nosniff");
    expect((await head.body()).length).toBe(0);
    for (const suffix of [
      "snapshots/after/mokly.config.json",
      "snapshots/after/mokly-generated/removed/index.mobile.html",
      "entries/sample.json",
    ]) {
      expect(
        (await page.request.get(`${selected.url()}${suffix}`)).status(),
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
            `${fixture.url}/mokly-viewer/diffs/selection?${query}`,
          )
        ).status(),
      ).toBe(400);
    }
    expect(
      (
        await page.request.get(
          `${fixture.url}/mokly-viewer/diffs/generations/missing/`,
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
