import assert from "node:assert/strict";

import { act, createElement, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";

import { memoryStorage, tabAt } from "../page-window";
import type { TestLocation } from "../page-window";

/** Mount a real hook in one screen and record its page's trips and popups. */
export function leaveScreen<T>(
  useScreen: (seen: string[]) => T,
  location: TestLocation = tabAt(),
) {
  const seen: string[] = [];
  const opened: unknown[][] = [];
  const page = Object.assign(new EventTarget(), {
    location: {
      ...location,
      assign: (url: string) => void seen.push("leave " + url),
    },
    open: (...given: unknown[]) => opened.push(given),
    sessionStorage: memoryStorage(),
    stop: () => void seen.push("stop"),
    event: undefined,
    HTMLIFrameElement: class {},
  });
  const fragment = Object.assign(new EventTarget(), {
    nodeType: 11,
    nodeName: "#document-fragment",
    ownerDocument: new EventTarget(),
    textContent: "",
    firstChild: null,
  });
  let committed: T | undefined;
  function Screen() {
    const value = useScreen(seen);
    useLayoutEffect(() => {
      committed = value;
    });
    return null;
  }
  const root = createRoot(fragment as unknown as DocumentFragment);
  let screens = 0;
  let unmounted = false;
  const current = () => {
    assert.ok(committed);
    return committed;
  };
  return {
    seen,
    opened,
    page,
    current,
    mount() {
      act(() => root.render(createElement(Screen, { key: ++screens })));
      return current();
    },
    unmount() {
      if (unmounted) return;
      act(() => root.unmount());
      unmounted = true;
    },
  };
}

/** The event the browser sends when it restores a page from its cache. */
export function restoredPage(): Event {
  return Object.assign(new Event("pageshow"), { persisted: true });
}
