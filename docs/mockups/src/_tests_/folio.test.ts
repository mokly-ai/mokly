import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { parse } from "parse5";

import { catalogueEntries } from "./catalogue-index";
import { catalogueRoot, screenFile } from "./catalogue-paths";
import { drawnPalette } from "./catalogue-reads";
import { variantParent } from "./catalogue-variants";
import { attribute, byClass, elements } from "./design-site-test-helpers";
import {
  canvasScreens,
  folioInventoryViolations,
  folioScreens,
  permanentScreens,
} from "./folio-inventory";

/**
 * Whether a document draws the package's viewer shell. Every document also
 * loads Mokly's inspector from `/mokly-viewer/`, so the shell is its root
 * element's class, not the bare name.
 */
function drawsViewerShell(html: string): boolean {
  return /class="(?:[^"]* )?mokly-viewer[ "]/.test(html);
}

test("Folio and Canvas screens have permanent ids and folders, with all registered controls retained", () => {
  const entries = catalogueEntries();
  assert.deepEqual(folioInventoryViolations(entries, drawnPalette), []);
  for (const { path: id } of permanentScreens) {
    assert.ok(
      folioInventoryViolations(
        entries.filter((e) => e.path !== id),
        drawnPalette,
      ).length,
      id,
    );
    assert.ok(
      folioInventoryViolations(entries, (path) =>
        path === id ? "default" : drawnPalette(path),
      ).length,
      id,
    );
    assert.ok(
      folioInventoryViolations(
        entries.map((e) =>
          e.path === id && e.kind === "screen"
            ? { ...e, path: "explore/old" }
            : e,
        ),
        drawnPalette,
      ).length,
      id,
    );
  }
  // A viewer screen drawn in Folio, and a Folio screen drawn in Canvas, are
  // both in the wrong palette.
  for (const [screens, wrong] of [
    [canvasScreens, "folio"],
    [folioScreens, "canvas"],
  ] as const)
    for (const { path: id } of screens)
      assert.ok(
        folioInventoryViolations(entries, (path) =>
          path === id ? wrong : drawnPalette(path),
        ).length,
        id + " " + wrong,
      );
  assert.deepEqual(
    entries
      .filter((e) => e.kind === "component" && variantParent(e) === undefined)
      .map((e) => e.path)
      .sort(),
    [
      "avatar",
      "badge",
      "button",
      "card",
      "comment-thread",
      "content-list",
      "header",
      "input",
      "options-list",
      "page-frame",
      "panel",
      "responsive-menu",
      "review-illustration",
      "segmented",
      "selector",
      "settings-dialog",
      "settings-layer",
      "skeleton",
      "status-dot",
      "switch",
      "table",
      "textarea",
      "window-controls",
      "write-failure",
    ]
      .map((name) => "design/" + name)
      .sort(),
  );
});

test("retired product families stay absent while the Design site is present", () => {
  for (const path of [
    "explore",
    "marketing",
    "product/review",
    "user-flows/marketing",
    "assets",
    "src/entries/marketing",
    "src/screens/marketing",
    "src/screens/product/review",
    "styles/explore",
    "styles/marketing",
    "styles/marketing.css",
    "src/fixtures/explore.ts",
    "src/fixtures/product-review.ts",
    "src/fixtures/release.ts",
    "product/workspace",
    "src/entries/product/workspace",
    "src/screens/product/workspace",
    "src/screens/product/sidebar.tsx",
    "src/screens/product/publication-details.tsx",
  ])
    assert.ok(
      !existsSync(resolve(catalogueRoot, path)),
      "retired path: " + path,
    );
  for (const path of [
    "product",
    "design",
    "user-flows",
    "src/entries/index.mockup.tsx",
  ])
    assert.ok(
      !existsSync(resolve(catalogueRoot, path)),
      "route-mirroring path: " + path,
    );
  for (const path of [
    screenFile("product/viewer/standalone", "desktop"),
    resolve(catalogueRoot, "src/screens/product/viewer/chrome.tsx"),
    screenFile("design/site/home", "desktop"),
    resolve(catalogueRoot, "src/screens/design/site/home_screen.tsx"),
  ])
    assert.ok(existsSync(path), "viewer path: " + path);
  const config = readFileSync(
    resolve(catalogueRoot, "../../mokly.config.json"),
    "utf8",
  );
  assert.ok(!config.includes("explore/"));
  assert.ok(!config.includes("marketing"));
});

test("all preserved Folio and Canvas screens render both widths and schemes at permanent IDs", () => {
  for (const { path: id, palette } of permanentScreens)
    for (const viewport of ["mobile", "desktop"] as const)
      for (const scheme of ["light", "dark"] as const) {
        const html = readFileSync(screenFile(id, viewport, scheme), "utf8");
        assert.ok(html.includes('class="' + palette + '-scope"'), id);
        assert.ok(html.includes('data-mkc-screen="' + id + '"'));
        assert.ok(!html.includes("<iframe"));
        assert.ok(!html.includes("explore-"));
      }
});

test("ready viewer pages render the published package shell and cloud slots", () => {
  for (const id of ["product/viewer/standalone", "product/viewer/pull-request"])
    for (const viewport of ["mobile", "desktop"] as const)
      for (const scheme of ["light", "dark"] as const) {
        const html = readFileSync(screenFile(id, viewport, scheme), "utf8");
        const label = id + " " + viewport + " " + scheme;
        assert.ok(drawsViewerShell(html), label);
        assert.ok(html.includes('data-mokly-slot="topBarStart"'), label);
        assert.ok(html.includes('data-mokly-slot="topBarEnd"'), label);
        assert.ok(!html.includes('href="/'), label);
        assert.ok(html.includes(">Home<"), label);
        // The frames hold the cloud's sample screen and load no document.
        assert.ok(!html.includes("<iframe"), label);
        const frames = byClass(parse(html), "mbk-frame-wrap");
        assert.equal(frames.length, 2, label);
        for (const frame of frames)
          assert.equal(
            elements(
              frame,
              (element) =>
                attribute(element, "data-mkc-sample-screen") !== undefined,
            ).length,
            1,
            label,
          );
      }
});

test("private comparison recovery is drawn in the package stage overlay", () => {
  for (const viewport of ["mobile", "desktop"] as const)
    for (const scheme of ["light", "dark"] as const) {
      const html = readFileSync(
        screenFile(
          "product/viewer/standalone/catalogue/comparison",
          viewport,
          scheme,
        ),
        "utf8",
      );
      assert.ok(drawsViewerShell(html));
      assert.ok(html.includes('data-mokly-slot="stageOverlay"'));
      assert.ok(html.includes("Open catalogue in a new tab"));
      assert.ok(
        html.includes(
          'data-mkc-screen="product/viewer/standalone/catalogue/comparison"',
        ),
      );
    }
});

test("the desktop dialog opens over the viewer stage with its slots blank", () => {
  for (const viewport of ["mobile", "desktop"] as const)
    for (const scheme of ["light", "dark"] as const) {
      const pane = readFileSync(
        screenFile("product/settings/project", viewport, scheme),
        "utf8",
      );
      const label = viewport + " " + scheme;
      if (viewport !== "desktop") {
        assert.ok(!pane.includes("fo-settings-backdrop"), label);
        assert.ok(!pane.includes("fo-stage"), label);
        continue;
      }
      const stage = pane.slice(
        pane.indexOf("fo-settings-backdrop"),
        pane.indexOf("fo-settings-surface"),
      );
      assert.ok(stage.includes("fo-stage-bar"), label);
      assert.ok(stage.includes("fo-stage-canvas"), label);
      assert.ok(!/>[^<>]*[A-Za-z][^<>]*</.test(stage), "the stage is blank");
      for (const noun of ["Viewer", "Branch", "Pull request", "Published"])
        assert.ok(!stage.includes(noun), noun + " must not label the stage");
    }
});
