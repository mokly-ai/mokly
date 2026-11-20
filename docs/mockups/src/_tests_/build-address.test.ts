import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { parse } from "parse5";

import { screenFile } from "./catalogue-paths";
import {
  attribute,
  byClass,
  elements,
  label,
} from "./design-site-test-helpers";
import { unresolved } from "./stage-drawings";

/**
 * The build address before it resolves a build: while the read runs, when it
 * names nothing the reader can open, and when the read failed.
 */

test("a build address that resolved no build names This build in its slot", () => {
  for (const state of unresolved)
    for (const viewport of ["mobile", "desktop"] as const) {
      const where = state.path + " " + viewport;
      const page = parse(
        readFileSync(screenFile(state.path, viewport), "utf8"),
      );
      const bar = byClass(page, "fo-top-bar")[0];
      assert.ok(bar, where);
      assert.ok(
        elements(bar, (node) => label(node) === "This build").length > 0,
        where + " names This build",
      );
      assert.equal(
        label(byClass(bar, "fo-top-state-detail")[0]),
        state.detail,
        where,
      );
      const canvas = byClass(page, "fo-stage-canvas")[0];
      assert.equal(byClass(canvas, "fo-build").length, 0, where);
      // The stage says one thing: a state's title, or the read it waits for,
      // which its waiting card names in that title's place.
      const said = [
        ...byClass(canvas, "fo-state-title").filter(
          (title) => byClass(title, "fo-pending-label").length === 0,
        ),
        ...byClass(canvas, "fo-pending-label"),
      ].map(label);
      assert.deepEqual(said, [state.stage], where);
      assert.deepEqual(
        elements(canvas, (node) =>
          (attribute(node, "data-testid") ?? "").startsWith("firna-button-"),
        ).map((node) => [label(node), attribute(node, "data-testid")]),
        state.actions,
        where,
      );
      // A failure Mokly answered keeps its reference; loading has none.
      assert.equal(
        byClass(canvas, "fo-error-details").length,
        state.actions.length,
        where,
      );
    }
});
