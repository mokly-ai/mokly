import assert from "node:assert/strict";
import test from "node:test";

import { readShellBootstrapEnvelope } from "../src/standalone/bootstrap_envelope.js";

test("scoped shell envelopes accept document routes for hydration", () => {
  const envelope = {
    schemaVersion: 2,
    catalogue: {},
    context: { base: "", updateVersion: 0, comparisons: false },
    view: { kind: "target", entryPath: "example", entryKind: "document" },
  };
  assert.deepEqual(readShellBootstrapEnvelope(envelope), envelope);
});
