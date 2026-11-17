/**
 * The waits of the four panels the viewer's slots open. Each read draws the
 * panel's own layout, as the Wait composition in `folio-chrome.md` defines:
 * a list draws one placeholder row in the row's own frame, text that only a
 * non-empty list shows is a bar, every control in the read's region draws its
 * waiting form, and the read is named once. The old block of three bars is
 * gone. The stage's waits are in `viewer-waits.test.ts`.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { sample } from "../fixtures/product";
import {
  branches,
  publication,
  publicationAddress,
  publicationScreens,
  pullRequests,
  workspaces,
} from "../fixtures/publications";
import type { Viewport } from "./catalogue-paths";
import {
  attribute,
  byClass,
  elements,
  label,
} from "./design-site-test-helpers";
import {
  controlStates,
  drawnPage,
  linksIn,
  only,
  pendingLabels,
} from "./drawn-page";

const viewports: readonly Viewport[] = ["desktop", "mobile"];

/** The answer's own values that no panel wait may show. */
const refs = [...branches, ...pullRequests].map((ref) => ref.name);
const projects = workspaces.flatMap((group) => [
  group.name,
  ...group.projects.map((project) => project.name),
]);

/**
 * Each panel read: what screen readers and sighted readers hear, how many
 * waiting regions and placeholder rows it draws, the group labels in order
 * (a bar reads as ""), the panel's controls and whether each is disabled, how
 * many control placeholders it holds, and the answer's values it must hide.
 */
const panelWaits = [
  {
    wait: "product/viewer/switcher/loading",
    heard: [["Loading branches…", "screen-reader-only"]],
    regions: 1,
    rows: 2,
    groups: ["", ""],
    controls: [["Close", false]],
    placeholders: 0,
    hidden: refs,
  },
  {
    wait: "product/viewer/projects/loading",
    heard: [["Loading projects…", "screen-reader-only"]],
    regions: 1,
    rows: 1,
    groups: [],
    controls: [
      ["Close", false],
      ["Create project", true],
    ],
    placeholders: 1,
    hidden: projects,
  },
  {
    wait: "product/viewer/history/loading",
    heard: [["Loading publication history…", "screen-reader-only"]],
    regions: 1,
    rows: 1,
    groups: [],
    controls: [["Close", false]],
    placeholders: 0,
    hidden: [publication.time, publication.sha, "Current publication"],
  },
  {
    wait: "product/viewer/share/loading",
    heard: [
      ["Preparing the publication link…", "visible"],
      ["Loading screens…", "screen-reader-only"],
    ],
    regions: 2,
    rows: 1,
    groups: ["Screen"],
    controls: [
      ["Close", false],
      ["Copy link", true],
    ],
    placeholders: 2,
    hidden: [
      // Every link that the answer supplies starts with this address.
      publicationAddress,
      "Project members can open this link.",
      ...publicationScreens.map((screen) => screen.title),
    ],
  },
] as const;

test("a panel's read draws the panel's own groups with one placeholder row in each list", () => {
  for (const viewport of viewports)
    for (const entry of panelWaits) {
      const where = entry.wait + " " + viewport;
      const page = drawnPage(entry.wait, viewport);
      const panel = only(page.main, "fo-viewer-panel-body");
      assert.deepEqual(pendingLabels(page), entry.heard, where);
      for (const old of ["fo-pending", "fo-pending-shape"])
        assert.equal(byClass(page.main, old).length, 0, where + " " + old);
      const regions = byClass(panel, "fo-wait");
      assert.equal(regions.length, entry.regions, where);
      for (const region of regions) {
        assert.equal(attribute(region, "aria-busy"), "true", where);
        // A destination's label is known, but its target is the answer's.
        assert.deepEqual(linksIn(region), [], where);
      }
      const rows = regions.flatMap((region) =>
        byClass(region, "content-list-row").filter(
          (row) => byClass(row, "fo-wait-text").length > 0,
        ),
      );
      assert.equal(rows.length, entry.rows, where);
      assert.deepEqual(
        byClass(panel, "fo-group-label").map(label),
        entry.groups,
        where,
      );
      assert.deepEqual(
        controlStates(only(page.main, "fo-viewer-surface")),
        entry.controls,
        where,
      );
      assert.equal(
        byClass(panel, "fo-wait-control").length,
        entry.placeholders,
        where,
      );
      for (const value of entry.hidden)
        assert.ok(!label(panel).includes(value), where + " shows " + value);
    }
});

test("the switcher keeps its search, disabled, and the share link names its read", () => {
  for (const viewport of viewports) {
    const switcher = drawnPage("product/viewer/switcher/loading", viewport);
    const search = elements(
      switcher.main,
      (node) => attribute(node, "id") === "publication-search",
    );
    assert.deepEqual(
      search.map((field) => attribute(field, "aria-disabled")),
      ["true"],
      viewport,
    );
    // The link's field is the place that names its read, in its own frame.
    const share = drawnPage("product/viewer/share/loading", viewport);
    const panel = only(share.main, "fo-viewer-panel-body");
    assert.deepEqual(
      byClass(only(panel, "fo-wait-input"), "fo-pending-label").map(label),
      ["Preparing the publication link…"],
      viewport,
    );
    // The visibility is the project's, so its badge stays, and who can open
    // the link is the read's, so that line is a bar.
    const access = only(panel, "review-inline");
    assert.equal(label(access), sample.visibility, viewport);
    assert.equal(byClass(access, "fo-wait-text").length, 1, viewport);
  }
});
