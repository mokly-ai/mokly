import assert from "node:assert/strict";
import { test } from "node:test";

import type { InteractiveSourceCapture } from "../dist/build/interactive_source_capture.js";
import {
  INTERACTIVE_SOURCE_RESOLUTION_LIMIT,
  interactiveSourceResolutionKey,
} from "../dist/build/interactive_source_resolution.js";
import {
  interactiveSourceCaptureMessage,
  readInteractiveSourceCapture,
} from "../dist/server/controls/interactive_sources_ipc.js";
import { parseRuntimeMessage } from "../dist/server/controls/runtime_ipc.js";

const capture: InteractiveSourceCapture = {
  files: [
    { bytes: Buffer.from("source"), paths: ["entries/source.ts"] },
    {
      bytes: Buffer.from('export const card = "accepted";'),
      paths: ["node_modules/installed-style/card.module.css"],
    },
    {
      bytes: Buffer.alloc(0),
      paths: ["node_modules/installed-style/plain.css"],
    },
  ],
  resolutions: ["card.module.css", "plain.css"].map((stylesheet) => ({
    attributes: [],
    importer: {
      type: "installed",
      path: "node_modules/installed-style/index.js",
    },
    kind: "import-statement",
    specifier: `installed-style/${stylesheet}`,
    target: `node_modules/installed-style/${stylesheet}`,
  })),
};

test("installed importer IPC keeps its exact identity and reuses retained captures", () => {
  const message = interactiveSourceCaptureMessage(capture);
  assert.deepEqual(message.resolutions, capture.resolutions);
  assert.deepEqual(message.resolutions[0]?.importer, {
    type: "installed",
    path: "node_modules/installed-style/index.js",
  });
  const decoded = readInteractiveSourceCapture(message);
  assert.ok(decoded);
  assert.deepEqual(decoded, capture);
  assert.ok(Object.isFrozen(decoded.resolutions[0]?.importer));
  assert.strictEqual(
    readInteractiveSourceCapture(structuredClone(message), decoded),
    decoded,
  );
  assert.strictEqual(
    parseRuntimeMessage(runtimeCommand(message), decoded)?.runtime
      .interactiveSources,
    decoded,
  );
});

test("installed request keys include importer type, exact specifier, kind and attributes", () => {
  const request = capture.resolutions[0]!;
  assert.ok(request.importer.type === "installed");
  const key = interactiveSourceResolutionKey(request);
  for (const different of [
    {
      ...request,
      importer: { ...request.importer, type: "repository" as const },
    },
    { ...request, specifier: "./card.module.css" },
    { ...request, kind: "require-call" as const },
    { ...request, attributes: [{ key: "type", value: "css" }] },
  ])
    assert.notEqual(interactiveSourceResolutionKey(different), key);
});

for (const invalid of [
  "",
  "/node_modules/pkg/index.js",
  "../index.js",
  "node_modules/../index.js",
  "node_modules/./pkg/index.js",
  "node_modules//pkg/index.js",
  "node_modules/pkg/",
  "node_modules\\pkg\\index.js",
  "C:/node_modules/pkg/index.js",
  "node_modules/pkg/\0index.js",
]) {
  test(`installed importer IPC rejects unsafe path ${JSON.stringify(invalid)}`, () => {
    const value = interactiveSourceCaptureMessage(capture);
    assertRejected({
      ...value,
      resolutions: [
        {
          ...value.resolutions[0]!,
          importer: { type: "installed", path: invalid },
        },
      ],
    });
  });
}

for (const [label, changes] of [
  ["missing importer path", { importer: { type: "installed" } }],
  ["non-string importer path", { importer: { type: "installed", path: 42 } }],
  [
    "extra importer field",
    {
      importer: {
        type: "installed",
        path: "node_modules/pkg/index.js",
        extra: true,
      },
    },
  ],
  [
    "unknown importer type",
    { importer: { type: "package", path: "node_modules/pkg/index.js" } },
  ],
  ["uncaptured source target", { target: "entries/missing.ts" }],
  ["uncaptured stylesheet target", { target: "node_modules/pkg/missing.css" }],
  ["unsafe stylesheet target", { target: "../card.module.css" }],
  ["unknown kind", { kind: "unknown" }],
  ["empty specifier", { specifier: "" }],
  ["NUL specifier", { specifier: "installed-style/\0card.module.css" }],
  ["oversized UTF-8 specifier", { specifier: "é".repeat(1_025) }],
  [
    "unsorted attributes",
    {
      attributes: [
        { key: "z", value: "x" },
        { key: "a", value: "x" },
      ],
    },
  ],
  [
    "duplicate attributes",
    {
      attributes: [
        { key: "a", value: "x" },
        { key: "a", value: "y" },
      ],
    },
  ],
  [
    "extra attribute field",
    { attributes: [{ key: "a", value: "x", extra: true }] },
  ],
  [
    "oversized UTF-8 attribute key",
    { attributes: [{ key: "é".repeat(129), value: "x" }] },
  ],
  [
    "oversized UTF-8 attribute value",
    { attributes: [{ key: "a", value: "é".repeat(1_025) }] },
  ],
  ["NUL attribute", { attributes: [{ key: "a", value: "\0" }] }],
  [
    "too many attributes",
    {
      attributes: Array.from({ length: 17 }, (_, index) => ({
        key: String(index).padStart(2, "0"),
        value: "x",
      })),
    },
  ],
  [
    "oversized combined attributes",
    {
      attributes: ["a", "b", "c"].map((key) => ({
        key,
        value: "é".repeat(1_000),
      })),
    },
  ],
  [
    "aggregate importer bytes",
    { importer: { type: "installed", path: "x".repeat(8 * 1024 * 1024) } },
  ],
] as const) {
  test(`installed importer IPC rejects ${label}`, () => {
    const value = interactiveSourceCaptureMessage(capture);
    assertRejected({
      ...value,
      resolutions: [{ ...value.resolutions[0]!, ...changes }],
    });
  });
}

test("installed importer IPC validates record count, sorting and duplicate keys", () => {
  const value = interactiveSourceCaptureMessage(capture);
  assertRejected({ ...value, resolutions: [...value.resolutions].reverse() });
  assertRejected({
    ...value,
    resolutions: [value.resolutions[0], value.resolutions[0]],
  });
  assertRejected({
    ...value,
    resolutions: Array.from(
      { length: INTERACTIVE_SOURCE_RESOLUTION_LIMIT + 1 },
      (_, index) => ({
        ...value.resolutions[0]!,
        specifier: `package-${String(index).padStart(5, "0")}`,
      }),
    ),
  });
});

test("installed importer IPC requires its path to be an own field", () => {
  const value = interactiveSourceCaptureMessage(capture);
  const importer = Object.create({
    path: "node_modules/installed-style/index.js",
  }) as Record<string, unknown>;
  importer["type"] = "installed";
  assertRejected({
    ...value,
    resolutions: [{ ...value.resolutions[0]!, importer }],
  });
});

function assertRejected(value: unknown): void {
  assert.equal(readInteractiveSourceCapture(value), undefined);
  assert.equal(parseRuntimeMessage(runtimeCommand(value)), undefined);
}

function runtimeCommand(interactiveSources: unknown): object {
  return {
    type: "component-runtime",
    runtime: {
      bundle: { code: "bundle" },
      generation: "a".repeat(32),
      interactiveEntries: {},
      interactiveSources,
      outputSnapshot: { routes: [], orphanRoutes: [] },
      outputs: [],
      stylesheetRoutes: [],
      styleOutputs: [],
      deliveredStyleSources: [],
    },
  };
}
