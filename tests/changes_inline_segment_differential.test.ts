import assert from "node:assert/strict";
import test from "node:test";

import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { compareInlineClassification } from "./helpers/inline_classification_oracle.js";

for (const mode of ["committed", "derived"] as const)
  for (const selector of [".actual-only", ".entry", ".missing"])
    test(`${mode} flat duplicate ${selector} membership and evidence equal the whole-list path`, async (context) => {
      const fixture = await inlineChangesFixture(
        context,
        `<style>${selector} {color:red}${selector}{color:blue}${selector}{color:red}</style>`,
        `<style>${selector}{color:red}</style><style>${selector}{color:green}</style>`,
        { colorSchemes: false },
      );
      const result = await compareInlineClassification(fixture, mode);
      assert.deepEqual(
        result.changes.map((change) => change.after?.id).sort(),
        selector === ".actual-only"
          ? ["action"]
          : selector === ".entry"
            ? ["home"]
            : [],
      );
      const home = result.screens.find((screen) => screen.id === "home")!;
      assert.equal(home.views.length, 2);
      for (const view of home.views) {
        assert.equal(
          view.state,
          selector === ".missing" ? "unchanged" : "changed",
        );
        assert.deepEqual(
          view.inlineStyles,
          selector === ".actual-only"
            ? undefined
            : selector === ".entry"
              ? { status: "matched", selectors: [".entry"] }
              : { status: "excluded" },
        );
      }
    });

for (const mode of ["committed", "derived"] as const)
  test(`${mode} formatted duplicates and element splits are unchanged on both classification paths`, async (context) => {
    const fixture = await inlineChangesFixture(
      context,
      '<style nonce="a">.entry {color:red}.entry{color:red}.actual-only{padding:1px}</style>',
      '<style data-emotion="b">.actual-only {padding:1px}</style><style>.entry{color:red}</style><style>/*same*/.entry {color:red}</style>',
      { colorSchemes: false },
    );
    const result = await compareInlineClassification(fixture, mode);
    assert.deepEqual(result.changes, []);
    assert.deepEqual(result.affectedConsumers, []);
    assert.ok(
      result.screens.every((screen) =>
        screen.views.every(
          (view) => view.state === "unchanged" && !view.inlineStyles,
        ),
      ),
    );
  });
