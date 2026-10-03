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

test("entry validation rejects Windows device names without changing tag grammar", () => {
  const definition = defineScreen({ ...screenBase, id: "con" });
  assert.deepEqual(validateEntry(resolved(definition), validationConfig), [
    {
      code: "invalid-id",
      id: "con",
      message: "id must be globally unique kebab-case",
      sourceRelativePath,
    },
  ]);
  assert.deepEqual(tagViolations(["con"]), []);
});
