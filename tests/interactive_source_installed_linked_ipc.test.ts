import assert from "node:assert/strict";
import { test } from "node:test";

import type { InteractiveSourceCapture } from "../dist/build/interactive_source_capture.js";
import {
  interactiveSourceCaptureMessage,
  readInteractiveSourceCapture,
} from "../dist/server/controls/interactive_sources_ipc.js";
import { parseRuntimeMessage } from "../dist/server/controls/runtime_ipc.js";

const capture: InteractiveSourceCapture = {
  files: [
    { bytes: Buffer.from("source"), paths: ["entries/source.data"] },
    {
      bytes: Buffer.from('export const marker = "accepted";'),
      paths: [
        "node_modules/linked-package/index.ts",
        "packages/linked-package/index.ts",
      ],
    },
    {
      bytes: Buffer.from("installed"),
      paths: ["node_modules/outer-package/helper.js"],
    },
  ],
  resolutions: [
    {
      attributes: [],
      importer: {
        type: "installed",
        path: "node_modules/outer-package/index.js",
      },
      kind: "import-statement",
      specifier: "linked-package",
      target: "node_modules/linked-package/index.ts",
    },
  ],
};

for (const target of [
  "entries/source.data",
  "node_modules/linked-package/index.ts",
  "packages/linked-package/index.ts",
]) {
  test(`installed IPC accepts the saved repository target ${target}`, () => {
    const message = interactiveSourceCaptureMessage({
      ...capture,
      resolutions: [{ ...capture.resolutions[0]!, target }],
    });
    const decoded = readInteractiveSourceCapture(message);
    assert.ok(decoded);
    assert.equal(decoded.resolutions[0]?.target, target);
    assert.strictEqual(readInteractiveSourceCapture(message, decoded), decoded);
    assert.strictEqual(
      parseRuntimeMessage(command(message), decoded)?.runtime
        .interactiveSources,
      decoded,
    );
  });
}

for (const target of [
  "node_modules/outer-package/helper.js",
  "node_modules/outer-package/missing.css",
  "packages/linked-package/missing.ts",
  "../packages/index.ts",
]) {
  test(`installed IPC rejects a target without a saved stylesheet or repository blob: ${target}`, () => {
    const message = interactiveSourceCaptureMessage(capture);
    const invalid = {
      ...message,
      resolutions: [{ ...message.resolutions[0]!, target }],
    };
    assert.equal(readInteractiveSourceCapture(invalid), undefined);
    assert.equal(parseRuntimeMessage(command(invalid)), undefined);
  });
}

test("installed IPC rejects a linked target whose blob lacks its repository alias", () => {
  const message = interactiveSourceCaptureMessage(capture);
  const invalid = {
    ...message,
    files: message.files.map((file) => ({
      ...file,
      paths: file.paths.filter((path) => !path.startsWith("packages/")),
    })),
  };
  assert.equal(readInteractiveSourceCapture(invalid), undefined);
  assert.equal(parseRuntimeMessage(command(invalid)), undefined);
});

function command(interactiveSources: unknown): object {
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
