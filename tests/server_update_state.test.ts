import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { loadCatalogueSnapshot } from "../dist/server/catalogue_snapshot.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("published updates replace or clear changed-route shell state", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const server = await startCatalogueServer(config, {
    base: "main",
    snapshot: await loadCatalogueSnapshot(config, async () => ({
      schemaVersion: 1,
      baseRef: "main",
      baseCommit: "a".repeat(40),
      changedRoutes: ["screens/home.html"],
      removedEntries: [],
    })),
    port: 0,
  });
  fixture.beforeRemove(() => server.close());

  const initial = await (await fetch(server.url)).text();
  assert.match(initial, /data-mokly-update-version="1"/);
  assert.match(initial, /data-mokly-content-version="1"/);
  assert.match(initial, /class="mbk-nav-filter-count">1</);
  assert.match(
    initial,
    /data-changed="true"[^>]+data-route="screens\/home\.html"/,
  );

  server.publishUpdate({ kind: "evidence", changedRoutes: [], version: 2 });
  const noChanges = await (await fetch(server.url)).text();
  assert.match(noChanges, /data-mokly-update-version="2"/);
  assert.match(noChanges, /data-mokly-content-version="1"/);
  assert.match(noChanges, /class="mbk-nav-filter-count">0</);
  assert.doesNotMatch(noChanges, /data-changed="true"/);

  server.publishUpdate({
    changedRoutes: ["screens/details.html"],
    version: 2,
  });
  const stale = await (await fetch(server.url)).text();
  assert.match(stale, /class="mbk-nav-filter-count">0</);
  assert.doesNotMatch(stale, /data-changed="true"/);

  server.publishUpdate({ changedRoutes: null, version: 3 });
  const unavailable = await (await fetch(server.url)).text();
  assert.match(unavailable, /data-changes-status="unavailable"/);
  assert.match(unavailable, /data-filter="changed"/);
  assert.match(unavailable, /data-mokly-content-version="3"/);
  server.publishUpdate({ kind: "evidence", changedRoutes: [], version: 4 });
  assert.match(
    await (await fetch(server.url)).text(),
    /data-mokly-content-version="3"/,
  );
});
