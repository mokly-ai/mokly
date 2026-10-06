import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../packages/mokly/dist/build/compile.js";
import { writeCompilation } from "../packages/mokly/dist/build/transaction.js";
import { loadConfig } from "../packages/mokly/dist/config/load.js";
import { startCatalogueServer } from "../packages/mokly/dist/server/http.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { closeServers, occupyConsecutivePorts } from "./helpers/ports.js";

test("occupied ports advance sequentially to the first free port", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const occupied = await occupyConsecutivePorts(2);
  context.after(() => closeServers(occupied.servers));
  const server = await startCatalogueServer(config, {
    base: "origin/main",
    port: occupied.start,
  });
  fixture.beforeRemove(() => server.close());

  assert.equal(server.port, occupied.start + 2);
  assert.equal((await fetch(server.url)).status, 200);
  assert.equal(
    occupied.servers.every((blocker) => blocker.listening),
    true,
  );
});
