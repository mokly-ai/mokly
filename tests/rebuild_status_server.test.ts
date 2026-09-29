import assert from "node:assert/strict";
import test from "node:test";

import type { RebuildStatus } from "@mokly/viewer/runtime";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("watched status is private, replayed, and committed with its fence", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const initial = rebuildStatus(2, 1, true, {
    detail: "src/home.tsx failed",
    id: 2,
  });
  const server = await startCatalogueServer(config, {
    base: "main",
    port: 0,
    rebuildStatus: initial,
    updateVersion: 1,
  });
  fixture.beforeRemove(() => server.close());

  const page = await (await fetch(server.url)).text();
  assert.deepEqual(privateStatus(page), initial);
  const publicCatalogue = await (
    await fetch(`${server.url}/__mokly/catalogue.json`)
  ).text();
  assert.doesNotMatch(publicCatalogue, /rebuildStatus|src\/home\.tsx/);

  const events = await fetch(`${server.url}/__mokly/events`);
  assert.ok(events.body);
  const reader = events.body.getReader();
  const replay = await readEvents(reader, "event: rebuild");
  assert.match(replay, /event: ready\ndata: 1\n\nevent: rebuild\n/);
  assert.match(replay, /"sequence":2/);

  const cleared = rebuildStatus(3, 2, true, null);
  assert.equal(server.replaceRebuildStatus?.(cleared), "staged");
  assert.deepEqual(
    privateStatus(await (await fetch(server.url)).text()),
    initial,
  );
  server.publishUpdate({ version: 2 });
  const transition = await readEvents(reader, "event: update");
  assert.match(
    transition,
    /event: rebuild[\s\S]+"sequence":3[\s\S]+event: update\ndata: 2/,
  );
  const updated = await (await fetch(server.url)).text();
  assert.deepEqual(privateStatus(updated), cleared);
  assert.equal(
    server.replaceRebuildStatus?.({ ...cleared, updating: false }),
    "conflict",
  );
  await reader.cancel();
});

test("unwatched Serve omits rebuild status from private and public state", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const server = await startCatalogueServer(config, { base: "main", port: 0 });
  fixture.beforeRemove(() => server.close());
  const page = await (await fetch(server.url)).text();
  assert.equal(privateStatus(page), undefined);
  assert.doesNotMatch(page, /rebuildStatus/);
  assert.doesNotMatch(
    await (await fetch(`${server.url}/__mokly/catalogue.json`)).text(),
    /rebuildStatus/,
  );
});

function rebuildStatus(
  sequence: number,
  updateVersion: number,
  updating: boolean,
  failure: RebuildStatus["failure"],
): RebuildStatus {
  return { failure, sequence, updateVersion, updating };
}

function privateStatus(html: string): RebuildStatus | undefined {
  const state = html.match(
    /data-mokly-host-capability-state="" type="application\/json">([^<]+)<\/script>/,
  )?.[1];
  return state ? JSON.parse(state).rebuildStatus : undefined;
}

async function readEvents(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  until: string,
): Promise<string> {
  let text = "";
  while (!text.includes(until)) {
    const next = await reader.read();
    if (next.done) break;
    text += new TextDecoder().decode(next.value);
  }
  return text;
}
