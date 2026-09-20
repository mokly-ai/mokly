import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

import { readCatalogue } from "@mokly/viewer";
import { parseRemovedPagePreview, parseReviewResult } from "@mokly/viewer/data";

import { serve } from "../dist/server/serve.js";

import { createRemovedDeliveryFixture } from "./helpers/removed_delivery_fixture.js";

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
        assert.equal(
          (await fetch(`${running.url}/view/screens/current.html`)).status,
          200,
        );
        const pageResponse = await fetch(
          `${running.url}/__mokly/diffs/review.json?page=archive%2Fremoved.html`,
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
            await fetch(new URL(preview.documentPath, pageResponse.url))
          ).text(),
          /Previous page/,
        );
        const screenResponse = await fetch(
          `${running.url}/__mokly/diffs/review.json?route=screens%2Fremoved.html`,
        );
        assert.equal(
          screenResponse.status,
          200,
          await screenResponse.clone().text(),
        );
        const screen = parseReviewResult(await screenResponse.json())
          .screens[0];
        assert.equal(screen?.state, "removed");
        assert.ok(
          screen?.views.every((view) => view.beforePath && !view.afterPath),
        );
      } finally {
        await running.close();
      }
    },
  );
}

async function waitForReady(url: string): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt++) {
    const model = readCatalogue(
      await (await fetch(`${url}/__mokly/catalogue.json`)).json(),
    );
    if (model.changesStatus === "ready") return;
    await setTimeout(50);
  }
  throw new Error("Serve did not publish removed-entry evidence");
}
