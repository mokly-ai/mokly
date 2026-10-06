import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { normalizeBuildDiagnostics } from "../dist/build/build_warnings.js";
import { acquireOutputLock } from "../dist/build/output_lock.js";

import { warningFixture } from "./helpers/warning_generations.js";

test(
  "a failed rebuild suppresses old background warnings and completion replay",
  { timeout: 15000 },
  async (t) => {
    const fixture = await warningFixture(t);
    const running = await fixture.start();
    const first = await fixture.gate.next("background");
    first.release();
    await fixture.journal.wait("collected");
    const last = await fixture.gate.next("background", first.index + 1);
    await fs.writeFile(fixture.entryPath, "export const broken = ;");
    running.rebuild!();
    await fixture.journal.wait("failed:rebuild");
    last.release();
    await fixture.journal.wait("classified");
    assert.equal(fixture.emitted.length, 0, JSON.stringify(fixture.emitted));
  },
);

test(
  "a successful rebuild fences old background work before preparing its fixed renderer",
  { timeout: 15000 },
  async (t) => {
    const fixture = await warningFixture(t);
    const running = await fixture.start();
    const first = await fixture.gate.next("background");
    first.release();
    await fixture.journal.wait("collected");
    const last = await fixture.gate.next("background", first.index + 1);
    const lock = await acquireOutputLock(fixture.root);
    fixture.beforeRemove(() => lock.release());
    await fixture.fixRenderer();
    running.rebuild!();
    await fixture.journal.wait("reset");
    last.release();
    await fixture.journal.wait("classified");
    const boundary = fixture.journal.events.length;
    await lock.release();
    await fixture.journal.wait("finished:rebuild", boundary);
    await fixture.journal.wait("classified", boundary);
    assert.equal(fixture.emitted.length, 0, JSON.stringify(fixture.emitted));
  },
);

for (const fails of [false, true]) {
  test(
    `reconfiguration retires old warnings before loading config (fails=${fails})`,
    { timeout: 15000 },
    async (t) => {
      const fixture = await warningFixture(t);
      let release = () => {};
      const candidate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await fixture.start({
        configLoader: {
          async load() {
            fixture.journal.record("config-loading");
            await candidate;
            if (fails) throw new Error("candidate config failed");
            return fixture.config;
          },
        },
      });
      fixture.beforeRemove(() => release());
      const first = await fixture.gate.next("background");
      first.release();
      await fixture.journal.wait("collected");
      const last = await fixture.gate.next("background", first.index + 1);
      await fixture.fixRenderer();
      fixture.watchers.watchers[0]!.change(fixture.configPath);
      await fixture.journal.wait("config-loading");
      last.release();
      await fixture.journal.wait("classified");
      release();
      await fixture.journal.wait(
        `${fails ? "failed" : "finished"}:reconfigure`,
      );
      assert.equal(fixture.emitted.length, 0, JSON.stringify(fixture.emitted));
    },
  );
}

test(
  "background completion never adds its streamed warnings again",
  { timeout: 15000 },
  async (t) => {
    const fixture = await warningFixture(t);
    await fixture.start();
    const first = await fixture.gate.next("background");
    first.release();
    const last = await fixture.gate.next("background", first.index + 1);
    last.release();
    await fixture.journal.wait("classified");
    assert.equal(fixture.emitted.length, 2);
    assert.equal(fixture.sink.additions.length, 2);
    assert.deepEqual(
      normalizeBuildDiagnostics(fixture.sink.additions),
      fixture.emitted,
    );
  },
);
