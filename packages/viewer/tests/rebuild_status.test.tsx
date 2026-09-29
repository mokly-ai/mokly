import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { readCatalogue } from "../src/catalogue/reader.js";
import {
  readViewerCapabilityDescriptor,
  viewerCapabilityDescriptor,
} from "../src/client/host_capability_descriptor.js";
import { readRebuildStatus } from "../src/client/rebuild_status.js";
import {
  ViewerCapabilityBoundary,
  useViewerInitialRebuildStatus,
} from "../src/shell/capability_context.js";
import { adoptViewerRebuildStatus } from "../src/shell/capability_rebuild_status.js";

const catalogue = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);
const failure = {
  failure: { detail: "src/home.tsx failed", id: 2 },
  sequence: 2,
  updateVersion: 4,
  updating: false,
} as const;

test("rebuild status validation rejects extra keys and unsafe bounds", () => {
  assert.deepEqual(readRebuildStatus(failure), failure);
  for (const value of [
    { ...failure, extra: true },
    { ...failure, sequence: 0 },
    { ...failure, updateVersion: Number.MAX_SAFE_INTEGER + 1 },
    { ...failure, failure: { ...failure.failure, extra: true } },
    { ...failure, failure: { detail: "", id: 2 } },
    { ...failure, failure: { detail: "x".repeat(2_049), id: 2 } },
    { ...failure, failure: { detail: "failed", id: 3 } },
  ])
    assert.throws(() => readRebuildStatus(value), /Invalid watched rebuild/);
});

test("descriptor status is private, fenced, and available during SSR", () => {
  const context = {
    base: "origin/main",
    contentVersion: catalogue.revision.content,
    readModel: catalogue,
    rebuildStatus: failure,
    updateVersion: 4,
  };
  const descriptor = viewerCapabilityDescriptor(catalogue, context);
  assert.ok(descriptor);
  assert.deepEqual(descriptor.rebuildStatus, failure);
  assert.deepEqual(readViewerCapabilityDescriptor(descriptor), descriptor);
  assert.throws(
    () =>
      readViewerCapabilityDescriptor({
        ...descriptor,
        rebuildStatus: { ...failure, updateVersion: 5 },
      }),
    /rebuild status fence/,
  );
  const Probe = () => (
    <span>{useViewerInitialRebuildStatus()?.failure?.detail ?? "none"}</span>
  );
  assert.equal(
    renderToStaticMarkup(
      <ViewerCapabilityBoundary initialRebuildStatus={failure}>
        <Probe />
      </ViewerCapabilityBoundary>,
    ),
    "<span>src/home.tsx failed</span>",
  );
});

test("newer status waits for its source and stale replay cannot restore it", () => {
  const pending = {
    failure: null,
    sequence: 3,
    updateVersion: 5,
    updating: true,
  } as const;
  const staged = adoptViewerRebuildStatus(
    { rebuildStatus: failure },
    4,
    pending,
  );
  assert.deepEqual(staged.rebuildStatus, failure);
  assert.deepEqual(staged.pendingRebuildStatus, pending);
  const adopted = adoptViewerRebuildStatus(staged, 5);
  assert.deepEqual(adopted.rebuildStatus, pending);
  assert.equal(adopted.pendingRebuildStatus, undefined);
  assert.deepEqual(
    adoptViewerRebuildStatus(adopted, 5, failure).rebuildStatus,
    pending,
  );
});
