import assert from "node:assert/strict";
import test from "node:test";

import type { ComponentViewRecord } from "../packages/viewer/src/components/manifest_types.js";
import {
  ComponentValidationError,
  validateComponentViewRecord,
  validateComponentViews,
} from "../packages/viewer/src/data.js";

function emptyViews(): ComponentViewRecord[] {
  return ["mobile", "desktop"].map((viewport) => ({
    viewport: viewport as ComponentViewRecord["viewport"],
    colorScheme: "light",
    instances: [],
    slots: [],
    ranges: [],
  }));
}

for (const argument of [false, true, "action"])
  test(`public view validators reject legacy argument ${JSON.stringify(argument)}`, () => {
    const views = emptyViews();
    Object.assign(views[0]!, { styles: [], resources: [] });
    const components = new Map();
    assert.throws(
      () =>
        Reflect.apply(validateComponentViews, undefined, [
          views,
          false,
          components,
          "entry",
          argument,
        ]),
      ComponentValidationError,
    );
    assert.throws(
      () =>
        Reflect.apply(validateComponentViewRecord, undefined, [
          views[0],
          components,
          "entry",
          argument,
        ]),
      ComponentValidationError,
    );
    assert.ok(Object.hasOwn(views[0]!, "styles"));
    assert.ok(Object.hasOwn(views[0]!, "resources"));
  });

test("public view validators reject missing options and extra arguments", () => {
  const views = emptyViews();
  const components = new Map();
  for (const trailing of [[], [{ dark: false }, "action"]])
    assert.throws(
      () =>
        Reflect.apply(validateComponentViews, undefined, [
          views,
          components,
          "entry",
          ...trailing,
        ]),
      ComponentValidationError,
    );
  for (const trailing of [[], [{}, "action"]])
    assert.throws(
      () =>
        Reflect.apply(validateComponentViewRecord, undefined, [
          views[0],
          components,
          "entry",
          ...trailing,
        ]),
      ComponentValidationError,
    );
});

test("public view validators require exact, boolean-valued option objects", () => {
  const views = emptyViews();
  const components = new Map();
  for (const options of [
    null,
    false,
    "action",
    [],
    { unknown: false },
    { historical: "action" },
    { historicalUsage: "action" },
  ]) {
    assert.throws(
      () =>
        Reflect.apply(validateComponentViews, undefined, [
          views,
          components,
          "entry",
          options,
        ]),
      ComponentValidationError,
    );
    assert.throws(
      () =>
        Reflect.apply(validateComponentViewRecord, undefined, [
          views[0],
          components,
          "entry",
          options,
        ]),
      ComponentValidationError,
    );
  }
  assert.doesNotThrow(() =>
    validateComponentViews(views, components, "entry", { dark: false }),
  );
  assert.doesNotThrow(() =>
    validateComponentViewRecord(views[0]!, components, "entry", {}),
  );
});

test("only explicit historical options retire arrays without changing current validation", () => {
  const views = emptyViews();
  Object.assign(views[0]!, { styles: [null], resources: [42] });
  assert.throws(
    () => validateComponentViews(views, new Map(), "entry", { dark: false }),
    ComponentValidationError,
  );
  validateComponentViews(views, new Map(), "entry", {
    dark: false,
    historical: true,
  });
  assert.deepEqual(views, emptyViews());
});
