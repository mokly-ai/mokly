import assert from "node:assert/strict";
import { test } from "node:test";

import { transportError } from "../../api/errors";
import type { Session } from "../../api/types";
import type { SessionState } from "../../session/context";
import { createSessionReadOwner } from "../../session/read-owner";

import { session } from "./fixture";

function heldReads() {
  const pending: PromiseWithResolvers<Session>[] = [];
  let state: SessionState = { status: "loading" };
  let csrfToken = "";
  let signOuts = 0;
  const owner = createSessionReadOwner({
    readSession: () => {
      const answer = Promise.withResolvers<Session>();
      pending.push(answer);
      return answer.promise;
    },
    endSession: async () => {
      signOuts += 1;
    },
    publish: (next) => {
      state = next;
    },
    setCsrfToken: (next) => {
      csrfToken = next;
    },
  });
  return {
    owner,
    pending,
    current: () => ({ state, csrfToken }),
    signOuts: () => signOuts,
  };
}

for (const { olderRead, description } of [
  { olderRead: "refresh", description: "focus" },
  { olderRead: "reload", description: "reload" },
] as const) {
  test(`a newer focus answer owns state and CSRF while an older ${description} waits`, async () => {
    const reads = heldReads();
    reads.owner.adopt(session(false, "initial-csrf"));
    let olderFinished = false;
    const older = reads.owner[olderRead]().then(() => {
      olderFinished = true;
    });
    const newer = reads.owner.refresh();
    assert.equal(reads.pending.length, 2, olderRead);

    reads.pending[1].resolve(session(true, "new-csrf"));
    await newer;
    const expected = {
      state: { status: "signed-in", session: session(true, "new-csrf") },
      csrfToken: "new-csrf",
    };
    assert.equal(olderFinished, false, olderRead);
    assert.deepEqual(reads.current(), expected, olderRead);

    reads.pending[0].resolve(session(false, "old-csrf"));
    await older;
    assert.equal(olderFinished, true, olderRead);
    assert.deepEqual(reads.current(), expected, olderRead);
  });
}

for (const { replacement, description } of [
  { replacement: "adopt", description: "adoption" },
  { replacement: "signOut", description: "a successful sign-out" },
] as const) {
  test(`${description} invalidates pending session answers`, async () => {
    const reads = heldReads();
    const pending = reads.owner.reload();
    if (replacement === "adopt") {
      reads.owner.adopt(session(true, "adopted-csrf"));
    } else {
      await reads.owner.signOut();
    }
    const expected =
      replacement === "adopt"
        ? {
            state: {
              status: "signed-in",
              session: session(true, "adopted-csrf"),
            },
            csrfToken: "adopted-csrf",
          }
        : { state: { status: "signed-out" }, csrfToken: "" };
    assert.deepEqual(reads.current(), expected, replacement);
    assert.equal(reads.signOuts(), replacement === "signOut" ? 1 : 0);
    reads.pending[0].resolve(session(false, "stale-csrf"));
    await pending;
    assert.deepEqual(reads.current(), expected, replacement);
  });
}

test("a failed focus read ends loading and a late startup answer stays ignored", async () => {
  const reads = heldReads();
  const startup = reads.owner.reload();
  const focus = reads.owner.refresh();
  const error = transportError("focus-failure");
  reads.pending[1].reject(error);
  await focus;
  const expected = { state: { status: "error", error }, csrfToken: "" };
  assert.deepEqual(reads.current(), expected);
  reads.pending[0].resolve(session(false, "startup-csrf"));
  await startup;
  assert.deepEqual(reads.current(), expected);
});
