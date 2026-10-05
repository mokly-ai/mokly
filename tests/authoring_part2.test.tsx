import assert from "node:assert/strict";
import test from "node:test";

import { defineScreen } from "../dist/index.js";
import { validateEntry } from "../dist/registry/entry_validation.js";

import {
  resolved,
  screenBase,
  sourceRelativePath,
  tagViolations,
  validationConfig,
} from "./authoring_fixture.js";

test("empty tags are valid and equivalent to absent tags", () => {
  const empty = defineScreen({ ...screenBase, tags: [] });

  assert.deepEqual(empty.tags, []);
  assert.deepEqual(validateEntry(resolved(empty), validationConfig), []);
  assert.deepEqual(
    validateEntry(resolved(defineScreen(screenBase)), validationConfig),
    [],
  );
});

test("definitions do not invent a navigation label list", () => {
  const entry = defineScreen(screenBase);
  assert.equal(Object.hasOwn(entry, "navPath"), false);
  assert.deepEqual(validateEntry(resolved(entry), validationConfig), []);
});

test("entry validation rejects Windows device names without changing tag grammar", () => {
  const definition = defineScreen({ ...screenBase, path: "con" });
  assert.deepEqual(validateEntry(resolved(definition), validationConfig), [
    {
      code: "invalid-path",
      path: "con",
      message: "path must be a valid catalogue path",
      sourceRelativePath,
    },
  ]);
  assert.deepEqual(tagViolations(["con"]), []);
});
