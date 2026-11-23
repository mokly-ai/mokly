import assert from "node:assert/strict";
import { test } from "node:test";

import type { NavigationLink, NavigationRow } from "@mokly/ui/catalogue-tree";

import { createCatalogue } from "../src/shell/catalogue.js";
import { changePosition } from "../src/shell/change_position.js";
import type { ShellContext } from "../src/shell/context.js";
import { catalogueNavSections } from "../src/shell/nav_model.js";
import { navSection } from "../src/shell/nav_rows.js";
import { shellContext } from "../src/shell/projection.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { defaultSelection } from "../src/shell/selection.js";
import { createInitialShellState } from "../src/shell/store_initial.js";

import {
  publishedComponent,
  publishedDocument,
  publishedModel,
  publishedScreen,
  removedEntry,
  removedScreenVariant,
} from "./published_entries_fixture.js";
import { entryNode as e, folderNode as f } from "./tree_fixture.js";

/** A removed variant of Profile, which joins Profile's list. */
const locked = removedScreenVariant(
  "account/profile/locked",
  "Locked",
  { path: "account/profile", title: "Profile" },
  ["Account"],
);
/** A removed document without a parent, a flat row after the current rows. */
const terms = removedEntry(
  publishedDocument("guide/terms", "Terms", "removed"),
  ["Guide"],
);

/**
 * Account holds Profile, an unmodified screen whose list holds a changed
 * variant, the removed variant, a member folder with a changed screen, and
 * two members, one changed. Billing holds a changed and an unmodified screen.
 * Components holds one changed component.
 */
const tree = [
  f("account", "Account", [
    e("account/profile", [
      e("account/profile/unverified"),
      f("account/profile/devices", "Devices", [
        e("account/profile/devices/phone"),
      ]),
      e("account/profile/notifications"),
      e("account/profile/security"),
    ]),
  ]),
  f("billing", "Billing", [e("billing/invoice"), e("billing/plans")]),
  f("kit", "Kit", [e("kit/button")]),
];

const model = publishedModel({
  components: [publishedComponent("kit/button", "Button", "changed")],
  removedEntries: [locked, terms],
  screens: [
    publishedScreen("account/profile", "Profile"),
    publishedScreen(
      "account/profile/unverified",
      "Unverified email",
      "changed",
      "account/profile",
    ),
    publishedScreen("account/profile/devices/phone", "Phone", "changed"),
    publishedScreen("account/profile/notifications", "Notifications"),
    publishedScreen("account/profile/security", "Security", "changed"),
    publishedScreen("billing/invoice", "Invoice", "changed"),
    publishedScreen("billing/plans", "Plans"),
  ],
  tree,
});
const catalogue = createCatalogue(model);
const sections = catalogueNavSections(catalogue);
const context: ShellContext = shellContext(model, defaultSelection);

/** The address of a catalogue row, as the catalogue column links it. */
function rowHref(key: string): string | undefined {
  const state = createInitialShellState(
    catalogue,
    context,
    { view: { kind: "home" } },
    undefined,
  );
  const source = {
    context,
    identifier: (value: string) => value,
    store: { context, state },
  };
  const links = new Map<string, NavigationLink>();
  const visit = (rows: readonly NavigationRow[]): void => {
    for (const row of rows) {
      if (row.kind === "folder") {
        visit(row.rows);
        continue;
      }
      links.set(row.link.key, row.link);
      for (const variant of row.list?.variants ?? [])
        links.set(variant.key, variant);
      visit(row.list?.rows ?? []);
    }
  };
  for (const section of sections) visit(navSection(section, source).rows);
  return links.get(key)?.href;
}

/** The position of a current entry, or of a removed entry by its path. */
function at(path: string) {
  return changePosition(sections, context, { path });
}

test("the change list holds each changed entry once, in the tree's row order: a parent's variants, its removed variants, its member folder and members, the flat removed rows, then Components", () => {
  const order = [
    "account/profile/unverified",
    "account/profile/locked",
    "account/profile/devices/phone",
    "account/profile/security",
    "billing/invoice",
    "guide/terms",
    "kit/button",
  ];
  assert.deepEqual(
    order.map((path) => [at(path)?.position, at(path)?.total]),
    [
      [1, 7],
      [2, 7],
      [3, 7],
      [4, 7],
      [5, 7],
      [6, 7],
      [7, 7],
    ],
  );
});

test("an entry's previous and next changes are the entries around it, at their catalogue rows' addresses", () => {
  assert.deepEqual(at("account/profile/devices/phone"), {
    position: 3,
    total: 7,
    previous: {
      entryId: "account/profile/locked",
      snapshotId: locked.snapshotId,
      href: rowHref("removed:account/profile/locked"),
    },
    next: {
      entryId: "account/profile/security",
      href: rowHref("entry:account/profile/security"),
    },
  });
  // The removed neighbour's address names its snapshot, so it opens the
  // exact removed record.
  const href = at("account/profile/devices/phone")?.previous?.href;
  assert.ok(href);
  const route = routeFromUrl(catalogue, new URL(href, "https://mokly.test"));
  assert.equal(route.snapshot, locked.snapshotId);
  assert.equal(
    route.view.kind === "target" ? route.view.target.entry.path : undefined,
    "account/profile/locked",
  );
});

test("the first change has no previous change and the last change has no next change", () => {
  const first = at("account/profile/unverified");
  assert.equal(first?.previous, undefined);
  assert.equal(first?.next?.entryId, "account/profile/locked");
  assert.deepEqual(at("kit/button"), {
    position: 7,
    total: 7,
    previous: {
      entryId: "guide/terms",
      snapshotId: terms.snapshotId,
      href: rowHref("removed:guide/terms"),
    },
  });
});

test("an unmodified container row, an entry outside Changes, and Changes that are not ready give no position", () => {
  for (const path of [
    "account/profile",
    "account/profile/notifications",
    "billing/plans",
  ])
    assert.equal(at(path), undefined, path);
  const pending: ShellContext = { base: "main", changesStatus: "pending" };
  assert.equal(
    changePosition(sections, pending, {
      path: "account/profile/devices/phone",
    }),
    undefined,
  );
});

test("a removed entry matches its row by its path or by its own snapshot, and a snapshot of another record matches none", () => {
  const position = (snapshotId?: string) =>
    changePosition(sections, context, { path: "guide/terms", snapshotId })
      ?.position;
  assert.equal(position(), 6);
  assert.equal(position(terms.snapshotId), 6);
  assert.equal(position("f".repeat(64)), undefined);
});
