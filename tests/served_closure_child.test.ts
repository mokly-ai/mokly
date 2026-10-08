import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import type { ComponentRuntime } from "../dist/build/component_runtime.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import { runServerChild } from "../dist/server/child.js";
import { componentRuntimeMessage } from "../dist/server/controls/runtime_ipc.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
  type TestFixture,
} from "./helpers/fixture.js";

/** Play the watched parent for one in-process child on a live index. */
async function startChild(
  fixture: TestFixture,
  config: ResolvedConfig,
  runtime: ComponentRuntime,
  assetClosure?: readonly string[],
): Promise<string> {
  const descriptor = Object.getOwnPropertyDescriptor(process, "send");
  let resolveReady: (port: number) => void = () => {};
  let rejectReady: (error: unknown) => void = () => {};
  const ready = new Promise<number>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  Object.defineProperty(process, "send", {
    configurable: true,
    value: (message: { type: string; port?: number }) => {
      if (message.type === "component-runtime-request")
        queueMicrotask(() =>
          process.emit(
            "message",
            componentRuntimeMessage(runtime, 2),
            undefined,
          ),
        );
      if (message.type === "ready") resolveReady(message.port!);
    },
  });
  const running = runServerChild(
    config,
    0,
    "main",
    1,
    false,
    true,
    runtime.manifest,
    assetClosure,
  );
  void running.catch(rejectReady);
  fixture.beforeRemove(async () => {
    process.emit("message", { type: "shutdown" }, undefined);
    try {
      await running;
    } finally {
      if (descriptor) Object.defineProperty(process, "send", descriptor);
      else delete process.send;
    }
  });
  return `http://127.0.0.1:${await ready}`;
}

test("a restarted child serves its startup closure before its first background result", async (t) => {
  const fixture = await createFixture(
    validEntrySource({ body: '<a href="../../spec.pdf">PDF</a>' }),
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "spec.pdf"),
    "%PDF-1.4\nchecked",
  );
  await fs.writeFile(path.join(fixture.mockupsDir, "other.pdf"), "unlisted");
  const config = await loadConfig(fixture.root);
  const runtime = await prepareLiveRuntime(config);
  const url = await startChild(fixture, config, runtime, ["spec.pdf"]);
  assert.equal(
    await (await fetch(`${url}/static/spec.pdf`)).text(),
    "%PDF-1.4\nchecked",
  );
  assert.equal((await fetch(`${url}/static/other.pdf`)).status, 404);
});

test("a completion's current list replaces the closure of the compilation that a reload reused", async (t) => {
  const fixture = await createFixture(
    validEntrySource({ body: '<a href="../../guide.html">Guide</a>' }),
  );
  t.after(() => removeFixture(fixture));
  const guide = path.join(fixture.mockupsDir, "guide.html");
  await fs.writeFile(guide, "<p>Guide</p>");
  await fs.writeFile(
    path.join(fixture.mockupsDir, "spec.pdf"),
    "%PDF-1.4\nlinked",
  );
  const config = await loadConfig(fixture.root);
  const runtime = await prepareLiveRuntime(config);
  const reused = await compileCatalogue(config);
  assert.deepEqual(reused.manifest.assetClosure, ["guide.html"]);
  await fs.writeFile(guide, '<a href="spec.pdf">PDF</a>');
  const url = await startChild(fixture, config, runtime);
  const page = `${url}/static/guide.html`;
  const pdf = `${url}/static/spec.pdf`;
  assert.equal((await fetch(page)).status, 404);
  process.emit(
    "message",
    {
      type: "catalogue-complete",
      manifest: reused.manifest,
      generation: runtime.generation,
      version: 3,
      assetClosure: ["guide.html", "spec.pdf"],
    },
    undefined,
  );
  assert.equal((await fetch(page)).status, 200, "the child adopted it");
  assert.equal(await (await fetch(pdf)).text(), "%PDF-1.4\nlinked");
});
