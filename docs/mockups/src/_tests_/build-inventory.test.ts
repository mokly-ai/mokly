import assert from "node:assert/strict";
import { test } from "node:test";

import { catalogueEntries } from "./catalogue-index";
import { drawnPalette, entryModule } from "./catalogue-reads";
import {
  expectedProductScreens,
  productInventoryViolations,
} from "./product-inventory";

const folder = "product/viewer/standalone/build";

/** The screens one folder owns and their variants, in authored order. */
function screensIn(owner: string): [string, readonly string[]][] {
  return expectedProductScreens()
    .filter(
      (screen) => screen.path === owner || screen.path.startsWith(owner + "/"),
    )
    .map(({ path, variants }) => [path, variants]);
}

/** Whether filing one sibling screen as its owner's variant is refused. */
function refusedAsVariant(owner: string, sibling: string): boolean {
  return productInventoryViolations(
    catalogueEntries().map((entry) =>
      entry.path === sibling ? { ...entry, variantOf: owner } : entry,
    ),
    drawnPalette,
  ).includes("Folio parent screen: " + sibling);
}

/** The module that owns one current entry, as the catalogue index records it. */
function ownerModule(path: string): string | undefined {
  const entry = catalogueEntries().find((record) => record.path === path);
  return entry && entryModule(entry);
}

test("the build details sit in their own folder beside Standalone", () => {
  const build = expectedProductScreens().filter(
    (screen) => screen.path === folder || screen.path.startsWith(folder + "/"),
  );
  assert.deepEqual(screensIn(folder), [
    [
      folder,
      [
        folder + "/empty",
        folder + "/loading",
        folder + "/error",
        folder + "/published",
      ],
    ],
    [
      folder + "/failed",
      [
        folder + "/failed/timed-out",
        folder + "/failed/infrastructure",
        folder + "/failed/plan",
        folder + "/failed/version",
      ],
    ],
    [folder + "/superseded", [folder + "/superseded/cancelled"]],
    [folder + "/unreadable", []],
    [folder + "/lockfile", []],
    [folder + "/refused", [folder + "/refused/cancel"]],
    [folder + "/cancel-busy", []],
    [folder + "/try-again-busy", []],
    [
      folder + "/reader",
      [
        folder + "/reader/plan",
        folder + "/reader/plan-loading",
        folder + "/reader/queued",
        folder + "/reader/running",
      ],
    ],
  ]);
  for (const screen of build)
    for (const path of [screen.path, ...screen.variants]) {
      const module = ownerModule(path);
      assert.ok(module, path);
      assert.ok(
        module.startsWith("product/viewer/standalone/build/"),
        path + " " + module,
      );
    }
  // The running build owns the folder, and its siblings are screens beside it.
  assert.equal(
    ownerModule(folder),
    "product/viewer/standalone/build/index.mockup.tsx",
  );
  // A sibling screen filed as one of the running build's variants is refused.
  for (const sibling of [
    "/unreadable",
    "/lockfile",
    "/refused",
    "/cancel-busy",
    "/try-again-busy",
    "/reader",
  ])
    assert.ok(refusedAsVariant(folder, folder + sibling), sibling);
});

test("the pull request folder holds the closed, fork and Team cards beside the pull request", () => {
  const pull = "product/viewer/pull-request";
  assert.deepEqual(screensIn(pull), [
    [
      pull,
      [
        pull + "/empty",
        pull + "/loading",
        pull + "/error",
        pull + "/publishing",
      ],
    ],
    [pull + "/closed", [pull + "/closed/merged"]],
    [pull + "/fork", []],
    [pull + "/plan", [pull + "/plan/reader"]],
  ]);
  for (const card of ["/fork", "/plan"])
    assert.equal(
      ownerModule(pull + card),
      "product/viewer/pull-request" + card + ".mockup.tsx",
    );
  for (const sibling of ["/closed", "/fork", "/plan"])
    assert.ok(refusedAsVariant(pull, pull + sibling), sibling);
});

test("the refused and the busy publishing card are screens beside Publish", () => {
  const publish = "product/viewer/standalone/publish";
  const screens = new Map(
    expectedProductScreens().map(({ path, variants }) => [path, variants]),
  );
  assert.equal(screens.get(publish)?.length, 4);
  assert.deepEqual(screens.get(publish + "-refused"), [
    publish + "-refused/pull-request",
  ]);
  assert.deepEqual(screens.get(publish + "-busy"), []);
  for (const beside of ["-refused", "-busy"])
    assert.equal(
      ownerModule(publish + beside),
      "product/viewer/standalone/publish" + beside + ".mockup.tsx",
    );
});
