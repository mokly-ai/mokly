import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { FileSystemConfigLoader } from "../dist/config/load.js";

import { warningFixture } from "./helpers/warning_generations.js";

test(
  "an older background failure cannot flush a newer attempt's pending warnings",
  { timeout: 15000 },
  async (t) => {
    const fixture = await warningFixture(t);
    let releaseCandidate = () => {};
    const candidate = new Promise<void>((resolve) => {
      releaseCandidate = resolve;
    });
    const loader = new FileSystemConfigLoader();
    await fixture.start({
      configLoader: {
        async load(config, onWarning) {
          const next = await loader.load(config, onWarning);
          fixture.journal.record("candidate-loaded");
          await candidate;
          return next;
        },
      },
    });
    const first = await fixture.gate.next("background");
    first.release();
    await fixture.journal.wait("collected");
    const old = await fixture.gate.next("background", first.index + 1);
    fixture.beforeRemove(() => {
      old.fail();
      releaseCandidate();
    });
    await fixture.fixRenderer();
    await fs.writeFile(
      fixture.configPath,
      (await fs.readFile(fixture.configPath, "utf8")).replace(
        'review: { outDir: ".review" }',
        'review: { outDir: ".review", sharedImpact: [] }',
      ),
    );
    fixture.watchers.watchers[0]!.change(fixture.configPath);
    await fixture.journal.wait("candidate-loaded");
    const pending = fixture.sink.additions.at(-1)!;
    assert.equal(pending.code, "removed-shared-impact");
    assert.deepEqual(fixture.emitted, []);
    old.fail();
    await fixture.journal.wait("classified");
    assert.deepEqual(fixture.emitted, []);
    const boundary = fixture.journal.events.length;
    releaseCandidate();
    await fixture.journal.wait("finished:reconfigure", boundary);
    await fixture.journal.wait("complete", boundary);
    assert.deepEqual(fixture.emitted, [pending]);
  },
);
