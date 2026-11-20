import assert from "node:assert/strict";
import { test } from "node:test";

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

import { useLeavePage } from "../../navigation/leave-page";
import { tabAt, withWindow } from "../page-window";

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
  let leave: (url: string) => boolean = () => false;
  function Screen() {
    leave = useLeavePage(() => void seen.push("restored"));
    return null;
  }
  const root = createRoot(fragment as unknown as DocumentFragment);
  return {
    seen,
    page,
    /** Draw the screen, run `steps` while it is shown, then unmount it. */
    run(steps: (leave: (url: string) => boolean) => void) {
      withWindow(page, () => {
        act(() => root.render(createElement(Screen)));
        steps(leave);
        act(() => root.unmount());
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
