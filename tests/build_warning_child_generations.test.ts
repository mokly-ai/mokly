import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { acquireOutputLock } from "../dist/build/output_lock.js";
import { NodeProcessSupervisorFactory } from "../dist/server/supervisor.js";

import { warningFixture } from "./helpers/warning_generations.js";

for (const fails of [false, true]) {
  test(
    `preview child warnings retain their producing generation across a rebuild (fails=${fails})`,
    { timeout: 20000 },
    async (t) => {
      const fixture = await warningFixture(t);
      const factory = new NodeProcessSupervisorFactory();
      const running = await fixture.start({
        processSupervisorFactory: {
          create(...args) {
            const supervisor = factory.create(...args);
            const observe = supervisor.onPreviewResources!.bind(supervisor);
            supervisor.onPreviewResources = (callback) =>
              observe((value) => {
                callback(value);
                fixture.journal.record("preview-received");
              });
            return supervisor;
          },
        },
      });
      await fixture.gate.next("background");
      const current = fetch(
        `${running.url}/static/mokly-generated/home/index.mobile.html`,
      );
      const first = await fixture.gate.next("preview");
      first.release();
      assert.equal((await current).status, 200);
      await fixture.journal.wait("preview-received");
      assert.equal(fixture.emitted.length, 0);
      assert.equal(fixture.sink.additions[0]!.route, "home/index.mobile.html");
      const accepted = [...fixture.emitted];
      const response = fetch(
        `${running.url}/static/mokly-generated/home/index.desktop.html`,
      );
      const preview = await fixture.gate.next("preview", first.index + 1);
      const lock = await acquireOutputLock(fixture.root);
      fixture.beforeRemove(() => lock.release());
      if (fails)
        await fs.writeFile(fixture.entryPath, "export const broken = ;");
      else await fixture.fixRenderer();
      running.rebuild!();
      await fixture.journal.wait(fails ? "failed:rebuild" : "reset");
      const boundary = fixture.journal.events.length;
      preview.release();
      assert.equal((await response).status, 200);
      await fixture.journal.wait("preview-received", boundary);
      fixture.gate.releaseAll();
      await fixture.journal.wait("classified");
      await lock.release();
      if (!fails) await fixture.journal.wait("finished:rebuild");
      assert.deepEqual(fixture.emitted, accepted);
    },
  );
}
