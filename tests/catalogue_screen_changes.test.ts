import assert from "node:assert/strict";
import test from "node:test";

import { computeCatalogueChanges } from "../dist/server/changed.js";
import { readCatalogueChanges } from "../dist/server/component_changes.js";
import { homePage } from "../dist/server/pages.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { projectCatalogue } from "../src/catalogue/projection.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";
import { validEntrySource } from "./helpers/fixture.js";
import { publicShellContext } from "./helpers/public_shell.js";
import { screenVariantEntrySource } from "./helpers/screen_variant_fixture.js";

test("screen-only live view states use real material attribution without snapshots", async (t) => {
  const fixture = await componentReviewFixture(
    t,
    (source) =>
      source.replace(
        'id="home-mobile"',
        'id="home-mobile" data-content="changed"',
      ),
    validEntrySource(),
  );
  const evidence = await readCatalogueChanges(
    fixture.config,
    fixture.after.manifest,
    "main",
    fixture.git,
    "a".repeat(40),
  );
  const model = projectCatalogue({
    configPath: "mokly.config.ts",
    catalogue: createCatalogue(fixture.after.manifest),
    changesStatus: "ready",
    evidence,
    comparisonUrl: null,
    revision: { content: 1, evidence: 1 },
  });
  const home = model.screens.find((entry) => entry.id === "home")!;
  assert.deepEqual(home.changes, {
    status: "ready",
    kind: "changed",
    included: true,
  });
  assert.deepEqual(
    home.views.map((view) => view.comparison),
    [
      { status: "ready", kind: "changed", eligible: true },
      { status: "ready", kind: "changed", eligible: true },
      { status: "ready", kind: "unmodified", eligible: false },
      { status: "ready", kind: "unmodified", eligible: false },
    ],
  );
  assert.equal(model.comparisonUrl, null);
});

test("removing a variant retains its parent relationship and folder path", async (t) => {
  const fixture = await componentReviewFixture(
    t,
    () => screenVariantEntrySource({ includeVariant: false }),
    screenVariantEntrySource(),
  );
  const changes = await computeCatalogueChanges(
    fixture.config,
    "main",
    fixture.git,
    fixture.after.manifest,
  );

  assert.equal(changes.removedEntries.length, 1);
  const removed = changes.removedEntries[0];
  assert.ok(removed?.entry.kind === "screen");
  assert.equal(removed.entry.id, "home-empty");
  assert.equal(removed.entry.variantOf, "home");
  assert.deepEqual(removed.entry.navPath, ["Fixture"]);
  assert.ok(changes.changedRoutes.includes(removed.entry.route));
  assert.equal(changes.changedRoutes.includes("screens/home.html"), false);
});

test("removing a parent and variant retains one removed screen for each", async (t) => {
  const fixture = await componentReviewFixture(
    t,
    () =>
      screenVariantEntrySource({
        includeParent: false,
        includeVariant: false,
      }),
    screenVariantEntrySource(),
  );
  const changes = await computeCatalogueChanges(
    fixture.config,
    "main",
    fixture.git,
    fixture.after.manifest,
  );

  assert.deepEqual(
    changes.removedEntries.map(({ entry }) => [
      entry.id,
      entry.kind === "screen" ? entry.variantOf : undefined,
    ]),
    [
      ["home", undefined],
      ["home-empty", "home"],
    ],
  );
  assert.deepEqual(
    changes.changedRoutes.filter((route) => route.startsWith("screens/home")),
    ["screens/home.html", "screens/home.variants/empty.html"],
  );
});

test("a committed baseline places a removed variant under its parent row", async (t) => {
  const fixture = await componentReviewFixture(
    t,
    () => screenVariantEntrySource({ includeVariant: false }),
    screenVariantEntrySource(),
  );
  const changes = await computeCatalogueChanges(
    fixture.config,
    "main",
    fixture.git,
    fixture.after.manifest,
  );
  const catalogue = createCatalogue(
    fixture.after.manifest,
    changes.removedEntries,
  );

  const context = publicShellContext(catalogue, {
    base: "main",
    changedRoutes: changes.changedRoutes,
    updateVersion: 1,
  });
  const html = homePage(catalogue, context);

  assert.match(
    html,
    /<div class="mbk-nav-variants" data-nav-disclosure="variants:pages:home"[^>]*id="mb-nav-variants-pages-home"><a [^>]*data-nav-removed=""[^>]*data-removed-variant=""[^>]*hidden=""[^>]*data-route="screens\/home\.variants\/empty\.html"/,
  );
  assert.match(html, /Home empty · Removed<span class="mbk-nav-changed-text"/);
  assert.match(html, /<span class="mbk-nav-filter-count">1<\/span>/);
  assert.doesNotMatch(
    html,
    /data-changed="true"[^>]*data-route="screens\/home\.html"/,
  );
  assert.match(
    html,
    /data-changed="true"[^>]*data-route="screens\/home\.variants\/empty\.html"/,
  );
});
