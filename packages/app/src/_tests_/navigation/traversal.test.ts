import assert from "node:assert/strict";
import { after, before, test } from "node:test";

// A type-only import is erased, so the module still loads in `before`.
import type * as TraversalModule from "../../navigation/traversal";

type Traversal = typeof TraversalModule;

/**
 * The page the module runs in. It installs its `popstate` listener as it
 * loads, so the stand-in is in place before the import and stays for the
 * whole file.
 */
const popstate: ((event: PopStateEvent) => void)[] = [];
const page = {
  location: { pathname: "/acme/site" },
  history: {
    state: { id: "first" } as unknown,
    go: (delta?: number) => {
      void delta;
    },
  },
  addEventListener: (
    type: string,
    listener: (event: PopStateEvent) => void,
  ) => {
    if (type === "popstate") popstate.push(listener);
  },
};

let traversal: Traversal;
let saved: PropertyDescriptor | undefined;
let gateStops = false;
let heard = 0;

before(async () => {
  saved = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: page,
  });
  traversal = await import("../../navigation/traversal");
  traversal.gateTraversal(() => gateStops);
  traversal.onQueryOnlyTraversal(() => {
    heard += 1;
  });
});

after(() => {
  if (saved) Object.defineProperty(globalThis, "window", saved);
  else Reflect.deleteProperty(globalThis, "window");
});

/** Stand on one entry, as a `pushState` or `replaceState` leaves the page. */
function writeEntry(pathname: string, id: string): void {
  page.location.pathname = pathname;
  page.history.state = { id };
  traversal.noteRoutedEntry();
}

/** Land on one entry, as the browser does, and answer whether it stopped. */
function traverse(pathname: string, id: string | undefined): boolean {
  page.location.pathname = pathname;
  page.history.state = id === undefined ? null : { id };
  let stopped = false;
  const event = {
    stopImmediatePropagation: () => {
      stopped = true;
    },
  } as unknown as PopStateEvent;
  for (const listener of popstate) listener(event);
  return stopped;
}

test("a step within the router's own entry and path is kept from the router", () => {
  writeEntry("/acme/site", "first");
  const before = heard;
  assert.equal(traverse("/acme/site", "first"), true);
  assert.equal(heard, before + 1);
});

test("a step to another entry or path reaches the router and is recorded", () => {
  writeEntry("/acme/site", "first");
  const before = heard;
  assert.equal(traverse("/acme/other", "second"), false);
  assert.equal(traverse("/acme/site", "second"), false);
  assert.equal(heard, before);
  // The router is on the entry it was handed, so a query step there is kept.
  assert.equal(traverse("/acme/site", "second"), true);
});

test("an entry with no router id reaches the router", () => {
  writeEntry("/acme/site", "first");
  assert.equal(traverse("/acme/site", undefined), false);
});

test("a gate that stops a step wins, and nothing hears it", () => {
  writeEntry("/acme/site", "first");
  const before = heard;
  gateStops = true;
  try {
    assert.equal(traverse("/acme/other", "second"), true);
    assert.equal(traverse("/acme/site", "first"), true);
  } finally {
    gateStops = false;
  }
  assert.equal(heard, before);
});

test("the router's own history traversal reaches the router", () => {
  writeEntry("/acme/site", "first");
  window.history.go(-1);
  assert.equal(traverse("/acme/site", "first"), false);
  // The router records the entry it landed on, and steps are kept again.
  traversal.noteRoutedEntry();
  assert.equal(traverse("/acme/site", "first"), true);
});
