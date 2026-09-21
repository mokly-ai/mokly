import assert from "node:assert/strict";
import test from "node:test";

import { settledRenderCapability } from "./helpers/component_controls_state.js";

const capability = { token: "b".repeat(64), generation: "a".repeat(32) };

function shell(status?: string, usageComplete = true): string {
  const state = status ? `data-changes-status="${status}"` : "";
  const descriptor = {
    renderCapability: capability,
    schemaVersion: 1,
    source: {
      base: "main",
      catalogueId: "c".repeat(64),
      contentRevision: 4,
      evidenceRevision: 4,
      renderGeneration: capability.generation,
      updateVersion: 4,
    },
    workspace: { usageComplete },
  };
  return `<body data-mokly-update-version="4" ${state}><script data-mokly-host-capability-state="" type="application/json">${JSON.stringify(descriptor)}</script></body>`;
}

test("completed usage does not settle controls while Changes is pending", () => {
  assert.equal(settledRenderCapability(shell("pending")), undefined);
});

for (const status of ["ready", "unavailable"]) {
  test(`controls settle on the published ${status} Changes version`, () => {
    assert.deepEqual(settledRenderCapability(shell(status)), {
      ...capability,
      version: "4",
    });
  });
}

test("missing Changes status cannot supply a settled controls baseline", () => {
  assert.equal(settledRenderCapability(shell()), undefined);
});

test("partial usage cannot supply a settled controls baseline", () => {
  assert.equal(settledRenderCapability(shell("unavailable", false)), undefined);
});

test("settled controls require both authority and a published version", () => {
  const ready = shell("ready");
  assert.equal(
    settledRenderCapability(
      ready.replace('data-mokly-host-capability-state=""', ""),
    ),
    undefined,
  );
  assert.equal(
    settledRenderCapability(ready.replace('data-mokly-update-version="4"', "")),
    undefined,
  );
  assert.equal(
    settledRenderCapability(ready.replace(JSON.stringify(capability), "null")),
    undefined,
  );
  assert.equal(
    settledRenderCapability(
      ready.replace('"updateVersion":4', '"updateVersion":5'),
    ),
    undefined,
  );
});
