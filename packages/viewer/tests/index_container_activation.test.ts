import assert from "node:assert/strict";
import test from "node:test";

import { currentManifest } from "../../../tests/helpers/current_manifest.js";
import type { ManifestEntry, ManifestV9 } from "../src/registry/types.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { changesActivation } from "../src/shell/changes_activation.js";
import type { ShellContext } from "../src/shell/context.js";
import type { ShellRoute } from "../src/shell/routes.js";
import { defaultSelection } from "../src/viewer/selection.js";
import type { ViewerSelection } from "../src/viewer/types.js";

const screen = (path: string, title: string, variantOf?: string) =>
  ({
    colorSchemes: ["light"],
    description: title,
    kind: "screen",
    path,
    relatedDocs: [],
    sourcePath: `specs/${path}.mockup.tsx`,
    tags: [],
    title,
    useCasePaths: [],
    ...(variantOf ? { variantOf } : {}),
  }) as unknown as ManifestEntry;

/** Profile is its folder's own page, with a variant, a member folder, and members. */
const entries = [
  screen("account/profile", "Profile"),
  screen("account/profile/unverified", "Unverified email", "account/profile"),
  screen("account/profile/security", "Security"),
  screen("account/profile/notifications", "Notifications"),
  screen("account/profile/devices/phone", "Phone"),
];
const manifest: ManifestV9 = currentManifest({
  entries,
  folders: [],
  generatedBy: "mokly",
  schemaVersion: 9,
  sourceFiles: [],
});
const catalogue = createCatalogue(manifest);

function opened(
  changed: readonly string[],
  selection: Partial<ViewerSelection> = {},
  requested = "account/profile",
): string {
  const context: ShellContext = {
    base: "main",
    changedEntries: changed,
    changesStatus: "ready",
    updateVersion: 1,
  };
  const entry = catalogue.byPath.get(requested);
  assert.ok(entry);
  const route: ShellRoute = {
    view: { kind: "target", target: { kind: "entry", entry } },
  };
  const activated = changesActivation(
    catalogue,
    context,
    { ...defaultSelection, view: "changes", ...selection },
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
