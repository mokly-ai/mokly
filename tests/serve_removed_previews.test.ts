import assert from "node:assert/strict";
import test from "node:test";

import { readCatalogue } from "@mokly/viewer";
import {
  entryRoute,
  parseRemovedPagePreview,
  parseReviewResult,
  viewRoute,
} from "@mokly/viewer/data";

import { serve } from "../dist/server/serve.js";

import { createRemovedDeliveryFixture } from "./helpers/removed_delivery_fixture.js";
import { waitUntil } from "./helpers/wait_until.js";

for (const watch of [false, true]) {
  test(
    `Serve delivers removed page and screen generations (watch=${watch})`,
    { timeout: 30_000 },
    async (t) => {
      const fixture = await createRemovedDeliveryFixture();
      t.after(() => fixture.close());
      const running = await serve(fixture.config, {
        base: "origin/main",
        port: 0,
        watch,
      });
      try {
        await waitForReady(running.url);
        const model = readCatalogue(
          await (await fetch(`${running.url}/__mokly/catalogue.json`)).json(),
        );
        for (const removed of model.removedEntries)
          assert.deepEqual(removed.folderTitles, [
            "Fixture",
            "Deleted archive",
            "Deleted section",
          ]);
        assert.notEqual(fixture.baseCommit, fixture.branchEditCommit);
        assert.equal((await fetch(`${running.url}/view/current/`)).status, 200);
        const pageResponse = await fetch(
          `${running.url}/__mokly/diffs/review.json?page=fixture/deleted-archive/deleted-section/removed-page`,
        );
        assert.equal(
          pageResponse.status,
          200,
          await pageResponse.clone().text(),
        );
        const preview = parseRemovedPagePreview(await pageResponse.json());
        assert.equal(preview.baseCommit, fixture.baseCommit);
        assert.match(
          await (
            await fetch(
              new URL(
                `snapshots/before/${entryRoute(preview.path)}`,
                pageResponse.url,
              ),
            )
          ).text(),
          /Previous page/,
        );
        assert.doesNotMatch(
          await (
            await fetch(
              new URL(
                `snapshots/before/${entryRoute(preview.path)}`,
                pageResponse.url,
              ),
            )
          ).text(),
          /Branch edit/,
        );
        assert.equal(
          await (
            await fetch(
              new URL("snapshots/before/assets/nested.css", pageResponse.url),
            )
          ).text(),
          "main { color: rebeccapurple; }",
        );
        const screenResponse = await fetch(
          `${running.url}/__mokly/diffs/review.json?path=fixture/deleted-archive/deleted-section/removed-screen`,
        );
        assert.equal(
          screenResponse.status,
          200,
          await screenResponse.clone().text(),
        );
        const screen = parseReviewResult(await screenResponse.json())
          .screens[0];
        assert.equal(screen?.state, "removed");
        assert.ok(screen?.views.every((view) => view.state === "removed"));
        const screenDocument = await (
          await fetch(
            new URL(
              (() => {
                const view = screen?.views.find(
                  (candidate) => candidate.viewport === "desktop",
                );
                return view
                  ? `snapshots/before/${viewRoute("fixture/deleted-archive/deleted-section/removed-screen", view.viewport, view.colorScheme)}`
                  : "missing";
              })(),
              screenResponse.url,
            ),
          )
        ).text();
        assert.match(screenDocument, /Previous desktop screen/);
        assert.doesNotMatch(screenDocument, /Branch edit/);
      } finally {
        await running.close();
      }
    },
  );
}

async function waitForReady(url: string): Promise<void> {
  await waitUntil(
    async () => {
      const model = readCatalogue(
        await (await fetch(`${url}/__mokly/catalogue.json`)).json(),
      );
      return model.changesStatus === "ready";
    },
    {
      timeoutMs: 20_000,
      intervalMs: 50,
      message: "Serve did not publish removed-entry evidence",
    },
  );
}
