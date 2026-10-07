import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import { exportCatalogue } from "../dist/export/run.js";
import { startCatalogueServer } from "../dist/server/http.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

for (const delivery of ["Serve", "export"] as const) {
  test(`${delivery} keeps authored HTML separate from an identical generated-relative name`, async (t) => {
    const fixture = await createFixture(
      validEntrySource({
        body: '<iframe src="../../home/index.mobile.html" title="Authored" />',
      }),
    );
    t.after(() => removeFixture(fixture));
    await fs.mkdir(path.join(fixture.mockupsDir, "home"));
    await fs.writeFile(
      path.join(fixture.mockupsDir, "home/index.mobile.html"),
      '<!doctype html><html><body><a href="https://example.test/" data-mokly-link="details">External</a></body></html>',
    );
    const config = await loadConfig(fixture.root);
    let html: string;
    if (delivery === "Serve") {
      const server = await startCatalogueServer(config, {
        base: "main",
        port: 0,
      });
      fixture.beforeRemove(() => server.close());
      const response = await fetch(
        `${server.url}/static/home/index.mobile.html`,
      );
      assert.equal(response.status, 200);
      html = await response.text();
    } else {
      const result = await exportCatalogue(config, {
        outDir: "site",
        noChanges: true,
      });
      html = await fs.readFile(
        path.join(result.outDir, "static/home/index.mobile.html"),
        "utf8",
      );
    }
    assert.match(html, /href="https:\/\/example\.test\/"/);
    assert.doesNotMatch(html, /data-mokly-link|data-mokly-inspector/);
  });
}
