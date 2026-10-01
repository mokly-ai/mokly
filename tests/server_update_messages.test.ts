import assert from "node:assert/strict";
import test from "node:test";

import {
  childUpdateMessage,
  parseChildUpdateMessage,
  parseRebuildStatusMessage,
} from "../dist/server/update_messages.js";

test("watch update messages preserve available and unavailable route state", () => {
  assert.deepEqual(childUpdateMessage(2, ["home"]), {
    changedIds: ["home"],
    componentChanges: null,
    type: "update",
    version: 2,
  });
  assert.deepEqual(childUpdateMessage(3, undefined), {
    changedIds: null,
    componentChanges: null,
    type: "update",
    version: 3,
  });
  assert.deepEqual(
    parseChildUpdateMessage({
      changedIds: [],
      componentChanges: null,
      type: "update",
      version: 4,
    }),
    {
      changedIds: [],
      componentChanges: null,
      type: "update",
      version: 4,
    },
  );
});

test("watch update parsing rejects incomplete or unsafe IPC values", () => {
  for (const value of [
    null,
    { ...childUpdateMessage(2, undefined), kind: "unknown" },
    { ...childUpdateMessage(2, undefined), kind: null },
    { ...childUpdateMessage(2, undefined), changesStatus: "unknown" },
    { ...childUpdateMessage(2, undefined), changesStatus: null },
    { changedIds: null, componentChanges: null, type: "reload", version: 2 },
    { changedIds: null, componentChanges: null, type: "update", version: 0 },
    {
      changedIds: null,
      componentChanges: null,
      type: "update",
      version: 1.5,
    },
    {
      changedIds: undefined,
      componentChanges: null,
      type: "update",
      version: 2,
    },
    {
      changedIds: ["../home.html"],
      componentChanges: null,
      type: "update",
      version: 2,
    },
    { changedIds: [42], componentChanges: null, type: "update", version: 2 },
    { changedIds: null, type: "update", version: 2 },
  ]) {
    assert.equal(parseChildUpdateMessage(value), undefined);
  }
});

test("watch updates preserve explicit Changes loading and terminal states", () => {
  for (const status of [
    "preparing",
    "pending",
    "ready",
    "unavailable",
  ] as const) {
    const message = childUpdateMessage(
      2,
      status === "ready" ? [] : undefined,
      undefined,
      status,
    );
    assert.equal(message.changesStatus, status);
    assert.deepEqual(parseChildUpdateMessage(message), message);
  }
});

test("watch updates distinguish evidence from content without guessing from Changes status", () => {
  for (const kind of ["content", "evidence"] as const) {
    for (const status of [
      "preparing",
      "pending",
      "ready",
      "unavailable",
    ] as const) {
      const message = childUpdateMessage(
        2,
        status === "ready" ? [] : undefined,
        undefined,
        status,
        kind,
      );
      assert.equal(message.kind, kind);
      assert.deepEqual(parseChildUpdateMessage(message), message);
    }
  }
});

test("baseline handoffs preserve pinned commits and explicit revocation", () => {
  for (const commit of ["a".repeat(40), "b".repeat(64), null]) {
    const message = childUpdateMessage(
      2,
      undefined,
      undefined,
      "pending",
      "evidence",
      commit,
    );
    assert.equal(message.baselineCommit, commit);
    assert.deepEqual(parseChildUpdateMessage(message), message);
  }
  for (const baselineCommit of [
    "HEAD",
    "../escape",
    "a".repeat(41),
    "",
    12,
    {},
  ]) {
    assert.equal(
      parseChildUpdateMessage({
        ...childUpdateMessage(2, undefined),
        baselineCommit,
      }),
      undefined,
    );
  }
});

test("rebuild status IPC accepts only exact bounded snapshots", () => {
  const valid = {
    status: {
      failure: { detail: "src/home.tsx: failed", id: 2 },
      sequence: 3,
      updateVersion: 4,
      updating: true,
    },
    type: "rebuild-status",
  } as const;
  assert.deepEqual(parseRebuildStatusMessage(valid), valid);
  for (const value of [
    { ...valid, extra: true },
    { ...valid, type: "status" },
    { ...valid, status: { ...valid.status, extra: true } },
    { ...valid, status: { ...valid.status, sequence: 0 } },
    { ...valid, status: { ...valid.status, updateVersion: 1.5 } },
    {
      ...valid,
      status: { ...valid.status, failure: { detail: "", id: 2 } },
    },
    {
      ...valid,
      status: { ...valid.status, failure: { detail: "failed", id: 4 } },
    },
    {
      ...valid,
      status: {
        ...valid.status,
        failure: { detail: "x".repeat(2_049), id: 2 },
      },
    },
  ])
    assert.equal(parseRebuildStatusMessage(value), undefined);
});
