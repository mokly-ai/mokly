import assert from "node:assert/strict";
import { test } from "node:test";

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

import { unexpectedError } from "../../api/errors";
import type { Connection } from "../../api/types";
import {
  consumeGitHubCallback,
  githubFlowKeys,
} from "../../navigation/github-flow";
import { useLeavePage } from "../../navigation/leave-page";
import {
  memoryStorage,
  tabAt,
  withWindow,
  withWindowAsync,
} from "../page-window";

/** Where the screen in these tests leaves for. */
const trip = "https://github.com/login/oauth/authorize";

/**
 * One screen that uses `useLeavePage`, rendered by React DOM in this Node
 * process, with the page it runs in. The page records each trip it is sent on,
 * each trip it calls off and each restore the screen hears, in order.
 */
function screen() {
  const seen: string[] = [];
  const page = Object.assign(new EventTarget(), {
    location: {
      ...tabAt(),
      assign: (url: string) => void seen.push("leave " + url),
    },
    sessionStorage: memoryStorage(),
    stop: () => void seen.push("stop"),
    // React DOM reads these two of the page while it commits.
    event: undefined,
    HTMLIFrameElement: class {},
  });
  // Node has no DOM. A screen that renders nothing needs only these fields
  // of the fragment that React DOM renders it into.
  const fragment = Object.assign(new EventTarget(), {
    nodeType: 11,
    nodeName: "#document-fragment",
    ownerDocument: new EventTarget(),
    textContent: "",
    firstChild: null,
  });
  let leave: ReturnType<typeof useLeavePage> = () => false;
  function Screen() {
    leave = useLeavePage(() => void seen.push("restored"));
    return null;
  }
  const root = createRoot(fragment as unknown as DocumentFragment);
  let screens = 0;
  const mount = () => {
    act(() => root.render(createElement(Screen, { key: ++screens })));
    return leave;
  };
  const unmount = () => act(() => root.unmount());
  return {
    seen,
    page,
    mount,
    unmount,
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

/** The event the browser sends when it restores a page from its cache. */
function restoredPage(): Event {
  return Object.assign(new Event("pageshow"), { persisted: true });
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
  const { seen, page, mount, unmount } = screen();
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
