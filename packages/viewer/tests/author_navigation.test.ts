import assert from "node:assert/strict";
import { test } from "node:test";

import { isEntryPath, isLinkPath, isLogicalFragment } from "../src/data.js";

import cases from "./fixtures/author-checks/navigation.json" with { type: "json" };

test("shared catalogue path cases keep portable entry identities", () => {
  for (const fixture of cases.paths)
    assert.equal(isEntryPath(fixture.value), fixture.valid, fixture.value);
});

test("shared link paths check syntax before contextual resolution", () => {
  for (const fixture of cases.links)
    assert.equal(
      isLinkPath(fixture.value),
      fixture.syntaxAccepted,
      fixture.value,
    );
});

test("shared logical fragments accept Rust alphabetic and mark characters", () => {
  for (const fixture of cases.fragments)
    assert.equal(
      isLogicalFragment(fixture.value),
      fixture.valid,
      fixture.value,
    );
});
