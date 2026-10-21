import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogueNode } from "../src/catalogue/types.js";
import { changesActivation } from "../src/shell/changes_activation.js";
import type { ShellRoute } from "../src/shell/routes.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";
import { defaultSelection } from "../src/viewer/selection.js";
import type { ViewerSelection } from "../src/viewer/types.js";

import {
  publishedScreen,
  publishedModel,
} from "./published_entries_fixture.js";

/** Profile, under Account, has a variant, a member folder, and members. */
const screens = [
  ["account/profile", "Profile"],
  ["account/profile/unverified", "Unverified email", "account/profile"],
  ["account/profile/security", "Security"],
  ["account/profile/notifications", "Notifications"],
  ["account/profile/devices/phone", "Phone"],
] as const;
const tree: CatalogueNode[] = [
  {
    kind: "folder",
    path: "account",
    title: "Account",
    children: [
      {
        kind: "entry",
        path: "account/profile",
        children: [
          { kind: "entry", path: "account/profile/unverified" },
          {
            kind: "folder",
            path: "account/profile/devices",
            title: "Devices",
            children: [
              { kind: "entry", path: "account/profile/devices/phone" },
            ],
          },
          { kind: "entry", path: "account/profile/notifications" },
          { kind: "entry", path: "account/profile/security" },
        ],
      },
    ],
  },
];

/** The entry that Changes activation opens when Changes lists `changed`. */
function opened(
  changed: readonly string[],
  selection: Partial<ViewerSelection> = {},
  requested = "account/profile",
): string {
  const model = publishedModel({
    screens: screens.map(([path, title, variantOf]) =>
      publishedScreen(
        path,
        title,
        changed.includes(path) ? "changed" : "unmodified",
        variantOf,
      ),
    ),
    tree,
  });
  const catalogue = viewerCatalogue(model);
  const selected = {
    ...defaultSelection,
    view: "changes" as const,
    ...selection,
  };
  const entry = catalogue.byPath.get(requested);
  assert.ok(entry);
  const route: ShellRoute = {
    view: { kind: "target", target: { kind: "entry", entry } },
  };
  const activated = changesActivation(
    catalogue,
    viewerContext(model, selected),
    selected,
    route,
  );
  assert.equal(activated.view.kind, "target");
  return activated.view.kind === "target"
    ? activated.view.target.entry.path
    : "";
}

test("an unmodified index row opens its first visible changed member", () => {
  assert.equal(
    opened(["account/profile/security"]),
    "account/profile/security",
  );
  assert.equal(
    opened(["account/profile/security", "account/profile/notifications"]),
    "account/profile/notifications",
  );
});

test("list order puts variants first, then member folders, then members", () => {
  assert.equal(
    opened(["account/profile/security", "account/profile/devices/phone"]),
    "account/profile/devices/phone",
  );
  assert.equal(
    opened(["account/profile/security", "account/profile/unverified"]),
    "account/profile/unverified",
  );
});

test("only visible members are chosen, and a changed index keeps its own row", () => {
  assert.equal(
    opened(["account/profile/notifications", "account/profile/security"], {
      search: "security",
    }),
    "account/profile/security",
  );
  assert.equal(
    opened(["account/profile", "account/profile/security"]),
    "account/profile",
  );
  assert.equal(
    opened(["account/profile/security"], { view: "all" }),
    "account/profile",
  );
  assert.equal(
    opened(["account/profile/security"], { search: "zzz" }),
    "account/profile",
  );
});
