import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import { serve } from "../dist/server/serve.js";

import {
  declared,
  fixtureWithSheets,
} from "./helpers/component_stylesheet_fixture.js";
import { removeFixture } from "./helpers/fixture.js";
import { FakeWatcherFactory } from "./helpers/watch_config.js";

test("a throwing supervisor factory closes every startup watcher", async (t) => {
  const fixture = await fixtureWithSheets(declared());
  t.after(() => removeFixture(fixture));
  const watchers = new FakeWatcherFactory();
  const failure = new Error("supervisor factory failed");
  await assert.rejects(
    serve(
      await loadConfig(fixture.root),
      { port: 0, watch: true },
      {
        watcherFactory: watchers,
        processSupervisorFactory: {
          create() {
            throw failure;
          },
        },
      },
    ),
    (error) => error === failure,
  );
  assert.ok(
    watchers.watchers.length >= 2,
    "inventory and declared stylesheet watchers were created",
  );
  assert.deepEqual(
    watchers.watchers.map((watcher) => watcher.closed),
    watchers.watchers.map(() => true),
  );
});
