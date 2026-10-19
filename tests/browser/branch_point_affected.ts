import { expect } from "@playwright/test";

import type { UsageLink } from "../../packages/viewer/src/generated/catalogue/UsageLink.js";

/** Badge keeps each current destination, including the consumer's own variant. */
export function expectBadgeAffected(affected: UsageLink[]) {
  const destinations = new Map(
    affected.map(({ entryPath, entryKind, removed }) => {
      const destination = { entryPath, entryKind, removed };
      return [JSON.stringify(destination), destination];
    }),
  );
  expect(
    [...destinations.values()].sort((left, right) =>
      left.entryPath.localeCompare(right.entryPath),
    ),
  ).toEqual([
    {
      entryPath: "branch/consumers/archive/receipt",
      entryKind: "screen",
      removed: false,
    },
    {
      entryPath: "branch/consumers/archive/status",
      entryKind: "component",
      removed: false,
    },
    {
      entryPath: "branch/consumers/archive/status/default",
      entryKind: "component",
      removed: false,
    },
  ]);
}
