import assert from "node:assert/strict";
import test from "node:test";

import {
  childUpdateMessage,
  parseChildUpdateMessage,
} from "../dist/server/update_messages.js";

test("watch update messages preserve available and unavailable route state", () => {
  assert.deepEqual(childUpdateMessage(2, ["home"]), {
    changedEntries: ["home"],
    componentChanges: null,
    type: "update",
    version: 2,
  });
  assert.deepEqual(childUpdateMessage(3, undefined), {
    changedEntries: null,
    componentChanges: null,
    type: "update",
    version: 3,
  });
  assert.deepEqual(
    parseChildUpdateMessage({
      changedEntries: [],
      componentChanges: null,
      type: "update",
      version: 4,
    }),
    {
      changedEntries: [],
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
    {
      changedEntries: null,
      componentChanges: null,
      type: "reload",
      version: 2,
    },
    {
      changedEntries: null,
      componentChanges: null,
      type: "update",
      version: 0,
    },
    {
      changedEntries: null,
      componentChanges: null,
      type: "update",
      version: 1.5,
    },
    {
      changedEntries: undefined,
      componentChanges: null,
      type: "update",
      version: 2,
    },
    {
      changedEntries: ["../home.html"],
      componentChanges: null,
      type: "update",
      version: 2,
    },
    {
      changedEntries: [42],
      componentChanges: null,
      type: "update",
      version: 2,
    },
    { changedEntries: null, type: "update", version: 2 },
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
