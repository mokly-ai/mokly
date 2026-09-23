import assert from "node:assert/strict";
import { test } from "node:test";

import {
  attribute,
  byClass,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";
import {
  filterTargets,
  headCrumbs,
  headTitle,
  rowIcon,
  rowLabel,
  rowLabels,
  variantToggles,
} from "./helpers/design_rows.js";

const variantScreens = [
  ["design-browse-variant-selected", "design/browse/variants/selected.html"],
  ["design-browse-variant-changes", "design/browse/variants/changes.html"],
  ["design-browse-variant-removed", "design/browse/variants/removed.html"],
  ["design-browse-changed-views", "design/browse/variants/changed-views.html"],
] as const;

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: variant states render as light-only shells`, async () => {
    for (const [id, route] of variantScreens) {
      const { entry, document } = await designDocument(id, viewport);
      assert.equal(entry.route, route, id);
      assert.equal(entry.darkFragments, undefined, id);
      assert.equal(byClass(document, "mbk-shell").length, 1, id);
    }
  });

  test(`${viewport}: a selected variant keeps its parent's breadcrumb and title`, async () => {
    const { document } = await designDocument(
      "design-browse-variant-selected",
      viewport,
    );
    assert.equal(headTitle(document), "Empty workspace");
    assert.deepEqual(headCrumbs(document), [
      ["Catalogue home", "design-browse-home"],
      ["Example", undefined],
      ["Screens", undefined],
      ["Welcome", "design-browse-screen"],
    ]);
    assert.equal(
      textContent(byClass(document, "mbk-idchip")[0]!).trim(),
      "#example-welcome-empty",
    );
    const shot = byClass(document, "mbk-shot")[0];
    assert.ok(shot);
    assert.match(textContent(shot), /Workspace name/);
    assert.match(textContent(shot), /Create workspace/);
    assert.equal(byClass(document, "mbk-cmp-toolbar").length, 0);
  });

  test(`${viewport}: a changed variant is its own Changes row with a comparison band`, async () => {
    const { document } = await designDocument(
      "design-browse-variant-changes",
      viewport,
    );
    assert.equal(headTitle(document), "Save failed");
    assert.deepEqual(headCrumbs(document), [
      ["Catalogue home", "design-browse-home"],
      ["Example", undefined],
      ["Screens", undefined],
      ["Welcome", undefined],
    ]);
    assert.equal(byClass(document, "mbk-cmp-toolbar").length, 1);
    assert.match(textContent(document), /Couldn’t save this workspace/);
  });

  test(`${viewport}: a removed variant shows its previous version`, async () => {
    const { document } = await designDocument(
      "design-browse-variant-removed",
      viewport,
    );
    assert.match(textContent(document), /Showing previous version/);
    assert.match(textContent(document), /Couldn’t save this workspace/);
    assert.doesNotMatch(textContent(document), /This screen was removed/);
    assert.equal(byClass(document, "mbk-cmp-toolbar").length, 0);
    const details = byClass(document, "mbk-details-body")[0];
    assert.ok(details);
    assert.match(textContent(details), /No current screen/);
    assert.doesNotMatch(textContent(details), /screens\/welcome\.html/);
  });

  test(`${viewport}: changed views are marked on the view controls and listed in details`, async () => {
    const { document } = await designDocument(
      "design-browse-changed-views",
      viewport,
    );
    const viewportControl = byClass(document, "ce-viewport-control")[0];
    const appearance = byClass(document, "mbk-appearance")[0];
    assert.ok(viewportControl && appearance);
    assert.equal(byClass(viewportControl, "ce-view-changed").length, 1);
    const schemeMarks = byClass(appearance, "mbk-view-changed");
    assert.equal(schemeMarks.length, 1);
    assert.equal(attribute(schemeMarks[0]!, "aria-hidden"), "true");
    const selector = elements(
      appearance,
      (node) => node.tagName === "select",
    )[0];
    assert.ok(selector);
    const descriptionId = attribute(selector, "aria-describedby");
    assert.ok(descriptionId);
    const description = elements(
      appearance,
      (node) => attribute(node, "id") === descriptionId,
    )[0];
    assert.ok(description);
    assert.equal(textContent(description), "Other theme changed");
    assert.equal(byClass(document, "ce-theme-control").length, 0);
    const details = byClass(document, "mbk-details-body")[0];
    assert.ok(details);
    assert.match(textContent(details), /Changed views/);
    assert.match(textContent(details), /Mobile · Dark, Desktop · Dark/);
    const changedLink = elements(
      details,
      (node) => attribute(node, "data-mokly-link") === "design-review-changed",
    );
    assert.equal(changedLink.length, 1);
    assert.equal(byClass(document, "mbk-cmp-toolbar").length, 0);
  });
}

test("the canonical tree keeps Welcome's variant list collapsed", async () => {
  const { document } = await designDocument("design-browse-screen", "desktop");
  const toggles = variantToggles(document);
  assert.equal(toggles.length, 1);
  assert.equal(attribute(toggles[0]!, "aria-expanded"), "false");
  assert.equal(
    attribute(toggles[0]!, "aria-label"),
    "Show variants of Welcome",
  );
  assert.ok(!rowLabels(document).includes("Empty workspace"));
  assert.equal(byClass(document, "mbk-nav-changed").length, 0);
});

test("a selected variant discloses its parent's variant rows", async () => {
  const { document } = await designDocument(
    "design-browse-variant-selected",
    "desktop",
  );
  const toggles = variantToggles(document);
  assert.equal(toggles.length, 1);
  assert.equal(attribute(toggles[0]!, "aria-expanded"), "true");
  assert.equal(
    attribute(toggles[0]!, "aria-label"),
    "Hide variants of Welcome",
  );
  const leaf = byClass(document, "mbk-nav-leaf")[0];
  assert.ok(leaf);
  assert.equal(byClass(leaf, "mbk-nav-row").length, 1);
  const rows = byClass(document, "mbk-nav-row");
  assert.deepEqual(rows.map(rowLabel).slice(0, 5), [
    "Example",
    "Screens",
    "Welcome",
    "Empty workspace",
    "Save failed",
  ]);
  const selected = rows.find((row) => rowLabel(row) === "Empty workspace");
  assert.ok(selected);
  assert.equal(attribute(selected, "class"), "mbk-nav-row active");
  assert.equal(attribute(selected, "aria-current"), "page");
  assert.equal(
    attribute(selected, "data-mokly-link"),
    "design-browse-variant-selected",
  );
  const unselected = rows.find((row) => rowLabel(row) === "Save failed");
  assert.equal(unselected?.tagName, "span");
  const screens = rows.find((row) => rowLabel(row) === "Screens");
  assert.equal(
    textContent(byClass(screens!, "mbk-nav-count")[0]!).trim(),
    "2",
    "variants are not collection children",
  );
});

test("variant rows carry their own icon, not the screen icon", async () => {
  const { document } = await designDocument(
    "design-browse-variant-selected",
    "desktop",
  );
  const [emptyClass, emptyIcon] = rowIcon(document, "Empty workspace");
  const [failedClass, failedIcon] = rowIcon(document, "Save failed");
  const [welcomeClass, welcomeIcon] = rowIcon(document, "Welcome");
  const [detailsClass, detailsIcon] = rowIcon(document, "Details");
  assert.equal(emptyClass, "mbk-nav-ico variant");
  assert.equal(failedClass, "mbk-nav-ico variant");
  assert.equal(welcomeClass, "mbk-nav-ico");
  assert.equal(detailsClass, "mbk-nav-ico");
  assert.equal(emptyIcon, failedIcon, "every variant row draws one glyph");
  assert.equal(welcomeIcon, detailsIcon, "screen rows keep the screen icon");
  assert.notEqual(emptyIcon, welcomeIcon, "the variant glyph is its own");
});

test("Changes shows the changed variant row and marks its parent", async () => {
  const { document } = await designDocument(
    "design-browse-variant-changes",
    "desktop",
  );
  assert.deepEqual(rowLabels(document), [
    "Example",
    "Screens",
    "Welcome",
    "Save failed",
  ]);
  assert.equal(byClass(document, "mbk-nav-changed").length, 2);
  assert.deepEqual(
    byClass(document, "mbk-nav-changed-text").map((node) =>
      textContent(node).trim(),
    ),
    ["Changed", "Changed"],
  );
  const toggles = variantToggles(document);
  assert.equal(toggles.length, 1);
  assert.equal(attribute(toggles[0]!, "aria-expanded"), "true");
  const rows = byClass(document, "mbk-nav-row");
  const parent = rows.find((row) => rowLabel(row) === "Welcome");
  assert.equal(
    attribute(parent!, "data-mokly-link"),
    "design-browse-variant-changes",
    "the parent opens its first changed variant",
  );
  assert.equal(attribute(parent!, "aria-current"), undefined);
  const variant = rows.find((row) => rowLabel(row) === "Save failed");
  assert.equal(attribute(variant!, "class"), "mbk-nav-row active");
  assert.deepEqual(filterTargets(document), [
    ["All", "design-browse-variant-selected"],
  ]);
});

test("a removed variant stays under its surviving parent", async () => {
  const { document } = await designDocument(
    "design-browse-variant-removed",
    "desktop",
  );
  assert.deepEqual(rowLabels(document), [
    "Example",
    "Screens",
    "Welcome",
    "Save failed · Removed",
  ]);
  assert.equal(byClass(document, "mbk-nav-changed").length, 1);
  const rows = byClass(document, "mbk-nav-row");
  assert.equal(
    attribute(
      rows.find((row) => rowLabel(row) === "Save failed · Removed")!,
      "class",
    ),
    "mbk-nav-row active",
  );
  assert.deepEqual(filterTargets(document), [["All", "design-browse-screen"]]);
});

test("a change confined to other views keeps the parent row closed", async () => {
  const { document } = await designDocument(
    "design-browse-changed-views",
    "desktop",
  );
  assert.deepEqual(rowLabels(document), ["Example", "Screens", "Welcome"]);
  const toggles = variantToggles(document);
  assert.equal(toggles.length, 1);
  assert.equal(attribute(toggles[0]!, "aria-expanded"), "false");
  assert.equal(byClass(document, "mbk-nav-changed").length, 1);
  assert.deepEqual(filterTargets(document), [["All", "design-browse-screen"]]);
});
