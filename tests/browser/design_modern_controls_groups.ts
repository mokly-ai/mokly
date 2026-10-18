import assert from "node:assert/strict";

import screens from "../fixtures/design-library/screens.json" with { type: "json" };

const sections = [
  ["browse views", ["design/browse/views"]],
  ["browse states and changes", ["design/browse/states", "design/changes"]],
  ["component controls", ["design/components/controls"]],
  [
    "component inspection and inspector",
    ["design/components/inspection", "design/components/inspector"],
  ],
  [
    "component pages, states and overview",
    [
      "design/components/pages",
      "design/components/states",
      "design/components/overview",
    ],
  ],
] as const;

/** Bound each journey while retaining every screen in the shared inventory. */
export const designModernControlGroups = sections.map(([name, prefixes]) => ({
  name,
  screens: screens.filter(({ path }) =>
    prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)),
  ),
}));

const groupedPaths = designModernControlGroups.flatMap((group) =>
  group.screens.map((screen) => screen.path),
);
assert.equal(
  new Set(groupedPaths).size,
  groupedPaths.length,
  "Design workspace groups must not duplicate screens",
);
assert.deepEqual(
  [...groupedPaths].sort(),
  screens.map((screen) => screen.path).sort(),
  "Design workspace groups must cover screens.json exactly once",
);
for (const group of designModernControlGroups)
  assert(
    group.screens.length > 0 && group.screens.length <= 12,
    `Design workspace group ${group.name} must have 1 to 12 screens`,
  );
