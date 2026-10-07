import assert from "node:assert/strict";
import test from "node:test";

import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { BackgroundGeneration } from "../dist/server/demand/generation.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test(
  "failed background output never publishes complete usage or Changes",
  { timeout: 15000 },
  async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
    const written = deferred();
    const unavailable = deferred();
    let completed = 0;
    let classified = 0;
    const background = new BackgroundGeneration(
      {
        check() {},
        async write() {
          written.resolve();
          throw new Error("output transaction failed");
        },
      },
      {
        async read() {
          classified++;
          return undefined;
        },
      },
      () => completed++,
      (snapshot) => {
        assert.equal(snapshot, undefined);
        unavailable.resolve();
      },
      { writeOutput: true },
    );
    t.after(() => background.close());
    background.start(runtime, "main");
    await written.promise;
    await unavailable.promise;
    await background.invalidate();
    assert.equal(completed, 0);
    assert.equal(classified, 0);
  },
);

test(
  "superseded writes drain without publishing their old generation",
  { timeout: 15000 },
  async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
    const writing = deferred();
    const release = deferred();
    let completed = 0;
    let reads = 0;
    const background = new BackgroundGeneration(
      {
        check() {},
        async write() {
          writing.resolve();
          await release.promise;
        },
      },
      {
        async read() {
          reads++;
          return undefined;
        },
      },
      () => completed++,
      () => {},
      { writeOutput: true },
    );
    t.after(() => background.close());
    background.start(runtime, "main");
    await writing.promise;
    const replaced = background.invalidate();
    release.resolve();
    await replaced;
    assert.equal(completed, 0);
    assert.equal(reads, 0);
  },
);

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
