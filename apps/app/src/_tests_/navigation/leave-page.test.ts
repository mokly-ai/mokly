import assert from "node:assert/strict";
import { test } from "node:test";

import { unexpectedError } from "../../api/errors";
import type { Connection } from "../../api/types";
import {
  consumeGitHubCallback,
  githubFlowKeys,
} from "../../navigation/github-flow";
import { useLeavePage } from "../../navigation/leave-page";
import {
  memoryStorage,
  shellPage,
  withWindow,
  withWindowAsync,
} from "../page-window";
import type { TestLocation } from "../page-window";

import { leaveScreen, restoredPage } from "./leave-screen";

/** Where the screen in these tests leaves for. */
const trip = "https://github.com/login/oauth/authorize";

function screen(location?: TestLocation) {
  const subject = leaveScreen(
    (seen) => useLeavePage(() => void seen.push("restored")),
    location,
  );
  const { page, mount, unmount } = subject;
  return {
    ...subject,
    /** Draw the screen, run `steps` while it is shown, then unmount it. */
    run(steps: (leave: ReturnType<typeof useLeavePage>) => void) {
      withWindow(page, () => {
        try {
          steps(mount());
        } finally {
          unmount();
        }
      });
    },
  };
}

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test("a screen that unmounts while its page leaves calls the trip off", () => {
  const { seen, run } = screen();
  run((leave) => assert.equal(leave(trip), true));
  assert.deepEqual(seen, ["leave " + trip, "stop"]);
});

test("a screen that unmounts at rest calls nothing off", () => {
  const { seen, run } = screen();
  run(() => {});
  assert.deepEqual(seen, []);
});

test("a screen that unmounts after its page was restored calls nothing off", () => {
  const { seen, page, run } = screen();
  run((leave) => {
    assert.equal(leave(trip), true);
    page.dispatchEvent(restoredPage());
  });
  assert.deepEqual(seen, ["leave " + trip, "restored"]);
});

test("a late GitHub answer preserves the newer screen's flow and callback", async () => {
  const { seen, opened, page, mount, unmount } = screen(shellPage());
  const older = Promise.withResolvers<Connection>();
  await withWindowAsync(page, async () => {
    try {
      const oldLeave = mount();
      let olderAnswered = false;
      const pending = older.promise.then((connection) => {
        const left = oldLeave("sign-in", connection);
        olderAnswered = true;
        return left;
      });
      const newLeave = mount();
      assert.equal(
        newLeave("install-authorize", {
          authorizeUrl: trip + "?newer",
          state: "c".repeat(64),
          codeVerifier: "d".repeat(64),
        }),
        true,
      );
      assert.equal(olderAnswered, false);

      older.resolve({
        authorizeUrl: trip + "?older",
        state: "a".repeat(64),
        codeVerifier: "b".repeat(64),
      });
      assert.equal(await pending, false);
      assert.equal(olderAnswered, true);
      const abandoned = page.sessionStorage.getItem(githubFlowKeys["sign-in"]);
      assert.deepEqual(
        consumeGitHubCallback(
          new URLSearchParams(`code=provider-code&state=${"c".repeat(64)}`),
        ),
        {
          status: "valid",
          purpose: "install-authorize",
          code: "provider-code",
          state: "c".repeat(64),
          codeVerifier: "d".repeat(64),
        },
      );
      assert.equal(abandoned, null);
      assert.deepEqual(seen, ["leave " + trip + "?newer"]);
      assert.deepEqual(opened, []);
    } finally {
      unmount();
    }
  });
});

test("a GitHub trip with unavailable tab storage fails before leaving", () => {
  const { seen, page, run } = screen();
  page.sessionStorage = memoryStorage(true);
  run((leave) => {
    assert.throws(
      () =>
        leave("sign-in", {
          authorizeUrl: trip,
          state: "a".repeat(64),
          codeVerifier: "b".repeat(64),
        }),
      unexpectedError(),
    );
  });
  assert.deepEqual(seen, []);
});
