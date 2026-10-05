import assert from "node:assert/strict";
import test from "node:test";

import type { InteractiveSourceCapture } from "../dist/build/interactive_source_capture.js";
import { INTERACTIVE_SOURCE_RESOLUTION_LIMIT } from "../dist/build/interactive_source_resolution.js";
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
  resolutions: [
    {
      attributes: [],
      importer: { path: "entries/source.ts", type: "repository" },
      kind: "import-statement",
      specifier: "./second",
      target: "entries/second.ts",
    },
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
    resolutions: [
      {
        attributes: [],
        importer: { path: "entries/source.ts", type: "repository" },
        kind: "import-statement",
        specifier: "./second",
        target: "entries/second.ts",
      },
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
    outputSnapshot: { routes: [], orphanRoutes: [] },
    stylesheetRoutes: [],
    styleOutputs: [],
    deliveredStyleSources: [],
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
    "missing resolution lists",
    (value: Record<string, unknown>) => {
      delete value["resolutions"];
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
  [
    "extra resolution fields",
    (value: Record<string, unknown>) => {
      firstResolution(value)["extra"] = true;
    },
  ],
  [
    "unknown resolution kinds",
    (value: Record<string, unknown>) => {
      firstResolution(value)["kind"] = "unknown";
    },
  ],
  [
    "unsafe resolution importers",
    (value: Record<string, unknown>) => {
      firstResolution(value)["importer"] = {
        path: "../source.ts",
        type: "repository",
      };
    },
  ],
  [
    "unknown resolution importer identities",
    (value: Record<string, unknown>) => {
      firstResolution(value)["importer"] = { type: "virtual" };
    },
  ],
  [
    "oversized resolution specifiers",
    (value: Record<string, unknown>) => {
      firstResolution(value)["specifier"] = "x".repeat(2_049);
    },
  ],
  [
    "unsorted resolution attributes",
    (value: Record<string, unknown>) => {
      firstResolution(value)["attributes"] = [
        { key: "z", value: "first" },
        { key: "a", value: "second" },
      ];
    },
  ],
  [
    "duplicate resolution attributes",
    (value: Record<string, unknown>) => {
      firstResolution(value)["attributes"] = [
        { key: "type", value: "json" },
        { key: "type", value: "json" },
      ];
    },
  ],
  [
    "too many resolution attributes",
    (value: Record<string, unknown>) => {
      firstResolution(value)["attributes"] = Array.from(
        { length: 17 },
        (_, index) => ({
          key: `key-${String(index).padStart(2, "0")}`,
          value: "x",
        }),
      );
    },
  ],
  [
    "unsafe resolution targets",
    (value: Record<string, unknown>) => {
      firstResolution(value)["target"] = "../second.ts";
    },
  ],
  [
    "resolution targets absent from the capture",
    (value: Record<string, unknown>) => {
      firstResolution(value)["target"] = "entries/missing.ts";
    },
  ],
  [
    "duplicate resolution keys",
    (value: Record<string, unknown>) => {
      const resolution = firstResolution(value);
      value["resolutions"] = [resolution, structuredClone(resolution)];
    },
  ],
  [
    "too many resolutions",
    (value: Record<string, unknown>) => {
      const resolution = firstResolution(value);
      value["resolutions"] = Array.from(
        { length: INTERACTIVE_SOURCE_RESOLUTION_LIMIT + 1 },
        (_, index) => ({
          ...resolution,
          specifier: `package-${String(index).padStart(5, "0")}`,
        }),
      );
    },
  ],
  [
    "unsorted resolutions",
    (value: Record<string, unknown>) => {
      const resolution = firstResolution(value);
      value["resolutions"] = [
        { ...structuredClone(resolution), specifier: "z-package" },
        resolution,
      ];
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
      outputSnapshot: { routes: [], orphanRoutes: [] },
      stylesheetRoutes: [],
      styleOutputs: [],
      deliveredStyleSources: [],
    },
    type: "component-runtime",
  };
}

function firstFile(value: Record<string, unknown>): Record<string, unknown> {
  return (value["files"] as Record<string, unknown>[])[0]!;
}

function firstResolution(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return (value["resolutions"] as Record<string, unknown>[])[0]!;
}
