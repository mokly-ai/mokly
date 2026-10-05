import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

const validationCases = [
  {
    diagnostic: /invalid-definition/,
    exports: "forged, ...pane.entries,",
    extra: "const forged = { ...action.entries[0], variants: {} };",
    name: "forged variants",
  },
  {
    diagnostic: /variant/,
    extra: "action.entries.length = 1;",
    name: "mutated variants",
  },
  {
    diagnostic: /control/,
    extra: 'action.entries[0].controls = { unknown: { kind: "text" } };',
    name: "mutated controls",
  },
  {
    diagnostic: /options/,
    exactViolations: [
      "- [invalid-component] entries/fixture.mockup.tsx (action): [mokly/components] Component action $controls.label.options: expected nonempty options",
    ],
    extra: 'action.entries[0].controls = { label: { kind: "select" } };',
    name: "a parent select control without options",
    parentOnly: true,
  },
  {
    diagnostic: /unknown schema kind/,
    exactViolations: [
      "- [invalid-component] entries/fixture.mockup.tsx (action): [mokly/components] Component action $schema.kind: unknown schema kind",
    ],
    extra: 'action.entries[0].propSchema = { kind: "unknown" };',
    name: "an invalid parent prop schema",
    parentOnly: true,
  },
  {
    diagnostic: /description is required/,
    exactViolations: [
      "- [missing-metadata] entries/fixture.mockup.tsx (action): description is required",
    ],
    extra:
      'action.entries[0].description = ""; action.entries[0].controls = { label: { kind: "select" } };',
    name: "invalid parent metadata takes precedence over invalid controls",
    parentOnly: true,
  },
  {
    diagnostic: /render must be a function/,
    extra: "action.entries[0].render = null;",
    name: "mutated render",
  },
  {
    diagnostic: /label/,
    exactViolations: [
      "- [invalid-component] entries/fixture.mockup.tsx (action/default): [mokly/components] Component action / action/default $.label: string does not satisfy its length constraints",
    ],
    extra: "action.entries[1].props = { label: 42 };",
    name: "invalid variant props with a valid parent",
  },
] as const;

for (const validationCase of validationCases) {
  test(`registry validates ${validationCase.name} before rendering`, async (t) => {
    const fixture = await createFixture(
      componentEntrySource({
        extra: validationCase.extra,
        ...("exports" in validationCase
          ? { exports: validationCase.exports }
          : {}),
      }),
    );
    t.after(() => removeFixture(fixture));
    await assert.rejects(
      compileCatalogue(await loadConfig(fixture.root)),
      (error: Error) => {
        assert.notEqual(error.name, "TypeError");
        assert.match(error.message, /catalogue is invalid/i);
        assert.match(error.message, validationCase.diagnostic);
        if ("exactViolations" in validationCase)
          assert.deepEqual(
            error.message.split("\n").filter((line) => line.startsWith("- [")),
            validationCase.exactViolations,
          );
        if ("parentOnly" in validationCase && validationCase.parentOnly) {
          assert.doesNotMatch(error.message, /\(action\/default\):/);
          assert.doesNotMatch(error.message, /\(action\/disabled\):/);
        }
        if (
          "noInvalidComponent" in validationCase &&
          validationCase.noInvalidComponent
        )
          assert.doesNotMatch(error.message, /\[invalid-component\]/);
        return true;
      },
    );
  });
}

test("component variant ids use registry-wide duplicate-path diagnostics", async (t) => {
  const fixture = await createFixture(
    componentEntrySource().replace('slug: "disabled"', 'slug: "default"'),
  );
  t.after(() => removeFixture(fixture));
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /\[duplicate-path\].*action\/default/,
  );
});

test("an invalid component parent remains available to its variant relationships", async (t) => {
  const fixture = await createFixture(
    componentEntrySource({
      extra: 'action.entries[0].description = "";',
    }),
  );
  t.after(() => removeFixture(fixture));

  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    (error: Error) => {
      assert.match(error.message, /description is required/);
      assert.doesNotMatch(error.message, /variant parent does not exist/);
      assert.equal(
        error.message.split("\n").filter((line) => line.startsWith("- ["))
          .length,
        1,
      );
      return true;
    },
  );
});

test("a component rejected by definition validation remains available to its variants", async (t) => {
  const fixture = await createFixture(
    componentEntrySource({
      extra: "action.entries[0].render = null;",
    }),
  );
  t.after(() => removeFixture(fixture));

  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    (error: Error) => {
      assert.match(error.message, /render must be a function/);
      assert.doesNotMatch(error.message, /variant parent does not exist/);
      assert.equal(
        error.message.split("\n").filter((line) => line.startsWith("- ["))
          .length,
        1,
      );
      return true;
    },
  );
});

test("unbranded component-shaped helper exports are ignored", async (t) => {
  const fixture = await createFixture(
    componentEntrySource({
      extra:
        'export const helper = {kind:"component",path:"helper",render:() => {throw new Error("must not render");}};',
    }),
  );
  t.after(() => removeFixture(fixture));
  const compiled = await compileCatalogue(await loadConfig(fixture.root));
  assert.equal(
    compiled.manifest.entries.some((entry) => entry.path === "helper"),
    false,
  );
});
