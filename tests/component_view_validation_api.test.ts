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
    resources: [],
    insertedStylesheets: [],
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

test("historical options preserve strict v10 fields without mutating invalid input", () => {
  const views = emptyViews();
  Object.assign(views[0]!, { styles: [null], resources: [42] });
  assert.throws(
    () => validateComponentViews(views, new Map(), "entry", { dark: false }),
    ComponentValidationError,
  );
  const retained = structuredClone(views);
  assert.throws(
    () =>
      validateComponentViews(views, new Map(), "entry", {
        dark: false,
        historical: true,
      }),
    ComponentValidationError,
  );
  assert.deepEqual(views, retained);
});

for (const field of ["styles", "resources"])
  test(`historical view validation keeps immutable ${field} keys subject to v10 rules`, () => {
    const views = emptyViews();
    Object.defineProperty(views[0]!, field, {
      value: [],
      enumerable: true,
      configurable: false,
    });
    const validate = () =>
      validateComponentViews(views, new Map(), "entry", {
        dark: false,
        historical: true,
      });
    if (field === "styles") assert.throws(validate, ComponentValidationError);
    else assert.doesNotThrow(validate);
    assert.equal(
      Object.getOwnPropertyDescriptor(views[0]!, field)!.configurable,
      false,
    );
  });
