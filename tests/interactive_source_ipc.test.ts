import assert from "node:assert/strict";
import test from "node:test";

import type { InteractiveSourceCapture } from "../dist/build/interactive_source_capture.js";
import {
  interactiveSourceCaptureMessage,
  readInteractiveSourceCapture,
} from "../dist/server/controls/interactive_sources_ipc.js";
import {
  componentRuntimeMessage,
  parseRuntimeMessage,
} from "../dist/server/controls/runtime_ipc.js";

const capture: InteractiveSourceCapture = {
  files: [
    {
      bytes: Buffer.from("a"),
      paths: ["entries/alias.ts", "entries/source.ts"],
    },
    { bytes: Buffer.from("second"), paths: ["entries/second.ts"] },
  ],
};

test("runtime IPC uses the exact canonical source-capture projection", () => {
  const message = interactiveSourceCaptureMessage(capture);
  assert.deepEqual(message, {
    files: [
      {
        bytes: "YQ==",
        paths: ["entries/alias.ts", "entries/source.ts"],
      },
      { bytes: "c2Vjb25k", paths: ["entries/second.ts"] },
    ],
  });
  const command = componentRuntimeMessage({
    bundle: { code: "bundle", entrySources: [], filename: "bundle.js" },
    config: {} as never,
    generation: "a".repeat(32),
    interactiveEntries: {},
    interactiveSources: capture,
    manifest: {} as never,
    outputs: [],
  });
  assert.deepEqual(command.runtime.interactiveSources, message);
  assert.equal(Object.hasOwn(command.runtime, "config"), false);
  assert.equal(Object.hasOwn(command.runtime, "manifest"), false);
});

test("the child reuses an identical retained decoded capture", () => {
  const message = interactiveSourceCaptureMessage(capture);
  const first = readInteractiveSourceCapture(message);
  assert.ok(first);
  const second = readInteractiveSourceCapture(structuredClone(message), first);
  assert.strictEqual(second, first);

  const parsed = parseRuntimeMessage(runtimeCommand(message), first);
  assert.strictEqual(parsed?.runtime.interactiveSources, first);
});

for (const [label, mutate] of [
  [
    "extra envelope fields",
    (value: Record<string, unknown>) => {
      value["extra"] = true;
    },
  ],
  [
    "empty file lists",
    (value: Record<string, unknown>) => {
      value["files"] = [];
    },
  ],
  [
    "extra file fields",
    (value: Record<string, unknown>) => {
      firstFile(value)["extra"] = true;
    },
  ],
  [
    "noncanonical base64",
    (value: Record<string, unknown>) => {
      firstFile(value)["bytes"] = "YQ";
    },
  ],
  [
    "unsafe paths",
    (value: Record<string, unknown>) => {
      firstFile(value)["paths"] = ["../source.ts"];
    },
  ],
  [
    "unsorted paths",
    (value: Record<string, unknown>) => {
      firstFile(value)["paths"] = ["entries/source.ts", "entries/alias.ts"];
    },
  ],
  [
    "duplicate paths",
    (value: Record<string, unknown>) => {
      firstFile(value)["paths"] = ["entries/alias.ts", "entries/alias.ts"];
    },
  ],
  [
    "unsorted blobs",
    (value: Record<string, unknown>) => {
      const files = value["files"] as unknown[];
      value["files"] = [files[1], files[0]];
    },
  ],
] as const) {
  test(`source-capture IPC rejects ${label}`, () => {
    const value = structuredClone(
      interactiveSourceCaptureMessage(capture),
    ) as unknown as Record<string, unknown>;
    mutate(value);
    assert.equal(readInteractiveSourceCapture(value), undefined);
    assert.equal(parseRuntimeMessage(runtimeCommand(value)), undefined);
  });
}

function runtimeCommand(interactiveSources: unknown): object {
  return {
    runtime: {
      bundle: { code: "bundle" },
      generation: "a".repeat(32),
      interactiveEntries: {},
      interactiveSources,
      outputs: [],
    },
    type: "component-runtime",
  };
}

function firstFile(value: Record<string, unknown>): Record<string, unknown> {
  return (value["files"] as Record<string, unknown>[])[0]!;
}
