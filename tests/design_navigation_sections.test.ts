import assert from "node:assert/strict";
import test from "node:test";

import {
  navigationSections,
  type NavigationRow,
} from "../examples/basic/specs/design/library/chrome/catalogue-navigation-sections.js";

/** Each drawn row of every section as `key` or `key:count`. */
function drawn(rows: readonly NavigationRow[]): Record<string, string[]> {
  return Object.fromEntries(
    navigationSections(rows).map((section) => [
      section.id,
      section.rows.map((row) =>
        row.count === undefined ? row.key : `${row.key}:${row.count}`,
      ),
    ]),
  );
}

const folder = (key: string, depth: number, open?: true): NavigationRow => ({
  key,
  depth,
  kind: "folder",
  label: key,
  ...(open ? { open } : {}),
});
const screen = (key: string, depth: number): NavigationRow => ({
  key,
  depth,
  kind: "screen",
  label: key,
});

test("a closed folder counts its written rows without drawing them", () => {
  assert.deepEqual(
    drawn([folder("design", 0), screen("home", 1), screen("view", 1)]),
    { specs: ["design:2"] },
  );
});

test("an open folder draws its rows below its count", () => {
  assert.deepEqual(
    drawn([folder("design", 0, true), screen("home", 1), screen("view", 1)]),
    { specs: ["design:2", "home", "view"] },
  );
});

test("a child folder counts once, and keeps its own count while closed", () => {
  assert.deepEqual(
    drawn([
      folder("design", 0, true),
      folder("changes", 1),
      screen("current", 2),
      screen("overlay", 2),
      screen("home", 1),
    ]),
    { specs: ["design:2", "changes:2", "home"] },
  );
});

test("a variant row belongs to its parent and never counts as a folder row", () => {
  const rows = (variants: "closed" | "open"): NavigationRow[] => [
    folder("screens", 0, true),
    { ...screen("welcome", 1), variants },
    {
      key: "welcome-empty",
      depth: 2,
      kind: "variant",
      label: "Empty",
      variantParentKind: "screen",
    },
  ];
  assert.deepEqual(drawn(rows("closed")), {
    specs: ["screens:1", "welcome"],
  });
  assert.deepEqual(drawn(rows("open")), {
    specs: ["screens:1", "welcome", "welcome-empty"],
  });
});

test("a folder's own screen holds the folder's members under its disclosure", () => {
  const rows = (variants: "closed" | "open"): NavigationRow[] => [
    folder("account", 0, true),
    { ...screen("profile", 1), contents: true, variants },
    screen("security", 2),
  ];
  assert.deepEqual(drawn(rows("closed")), {
    specs: ["account:1", "profile"],
  });
  assert.deepEqual(drawn(rows("open")), {
    specs: ["account:1", "profile", "security"],
  });
});

test("each section counts only its own rows and omits a folder it does not hold", () => {
  assert.deepEqual(
    drawn([
      folder("example", 0, true),
      screen("welcome", 1),
      { key: "action", depth: 1, kind: "component", label: "Action" },
      folder("library", 0, true),
      { key: "badge", depth: 1, kind: "component", label: "Badge" },
      folder("empty", 0, true),
    ]),
    {
      specs: ["example:1", "welcome"],
      components: ["example:1", "action", "library:1", "badge"],
    },
  );
});

test("authors cannot type a folder count", () => {
  const row: NavigationRow = {
    ...folder("design", 0),
    // @ts-expect-error A folder count derives from the written rows.
    count: 3,
  };
  assert.deepEqual(drawn([row, screen("home", 1)]), { specs: ["design:1"] });
});
