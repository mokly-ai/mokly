import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { normalizeBuildDiagnostics } from "../dist/build/build_warnings.js";
import type { ComponentRuntime } from "../dist/build/component_runtime.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import type { GenerationWarning } from "../dist/build/warning_generation.js";
import {
  componentRuntimeMessage,
  parseRuntimeMessage,
} from "../dist/server/controls/runtime_ipc.js";
import { BackgroundCompilation } from "../dist/server/demand/background.js";

import { warningFixture } from "./helpers/warning_generations.js";
import {
  FakeSupervisor,
  FakeSupervisorFactory,
} from "./helpers/watch_config.js";

test(
  "background worker streams warnings tagged with the accepted attempt",
  { timeout: 15000 },
  async (t) => {
    const fixture = await warningFixture(t);
    const runtime = {
      ...(await prepareLiveRuntime(fixture.config)),
      warningGeneration: "c".repeat(32),
    };
    const events: GenerationWarning[] = [];
    const worker = new BackgroundCompilation(runtime, undefined, (event) =>
      events.push(event),
    );
    fixture.beforeRemove(() => worker.close());
    fixture.beforeRemove(() => fixture.gate.close());
    fixture.gate.releaseAll();
    const compilation = await worker.compilation;
    assert.equal(events.length, 2);
    assert.deepEqual(
      normalizeBuildDiagnostics(events.map((event) => event.warning)),
      compilation.diagnostics,
    );
    assert.deepEqual(
      events.map((event) => event.generation),
      [runtime.warningGeneration, runtime.warningGeneration],
    );
  },
);

test("runtime IPC retains the warning attempt separately from preview cache identity", async (t) => {
  const fixture = await warningFixture(t);
  const runtime = {
    ...(await prepareLiveRuntime(fixture.config)),
    warningGeneration: "d".repeat(32),
  };
  const message = componentRuntimeMessage(runtime);
  const decoded = parseRuntimeMessage(message);
  assert.ok(decoded);
  assert.notEqual(
    decoded.runtime.generation,
    decoded.runtime.warningGeneration,
  );
  assert.equal(decoded.runtime.warningGeneration, runtime.warningGeneration);
  assert.equal(Object.hasOwn(runtime, "warnings"), false);
  for (const warningGeneration of [
    undefined,
    null,
    5,
    "",
    "a".repeat(31),
    "A".repeat(32),
  ])
    assert.equal(
      parseRuntimeMessage({
        ...message,
        runtime: { ...message.runtime, warningGeneration },
      }),
      undefined,
    );
});

test(
  "resource reloads keep the accepted warning identity without reviving a failed attempt",
  { timeout: 15000 },
  async (t) => {
    const fixture = await warningFixture(t);
    fixture.gate.releaseAll();
    const accepted: ComponentRuntime[] = [];
    class Supervisor extends FakeSupervisor {
      override replaceComponentRuntime(runtime?: ComponentRuntime): void {
        assert.ok(runtime);
        accepted.push(runtime);
      }
    }
    fixture.config.stylesheets = [{ match: "**", stylesheets: ["action.css"] }];
    const running = await fixture.start({
      processSupervisorFactory: new FakeSupervisorFactory(new Supervisor()),
    });
    await fixture.journal.wait("classified");
    const initial = accepted[0]!;
    const warning = fixture.emitted[0]!;
    const source = fixture.watchers.watchers[0]!;
    source.change(path.join(fixture.mockupsDir, "action.css"));
    await fixture.journal.wait("finished:reload");
    assert.notEqual(accepted[1]!.generation, initial.generation);
    assert.equal(accepted[1]!.warningGeneration, initial.warningGeneration);
    await fs.writeFile(fixture.entryPath, "export const broken = ;");
    running.rebuild!();
    await fixture.journal.wait("failed:rebuild");
    const boundary = fixture.journal.events.length;
    source.change(path.join(fixture.mockupsDir, "action.css"));
    await fixture.journal.wait("finished:reload", boundary);
    assert.equal(accepted[2]!.warningGeneration, initial.warningGeneration);
    fixture.sink.addGeneration({
      generation: accepted[2]!.warningGeneration,
      warning,
    });
    assert.equal(fixture.emitted.length, 2);
  },
);
