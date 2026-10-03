import assert from "node:assert/strict";
import test from "node:test";

import type {
  ResolvedRegistryEntry,
  ScreenVariantInput,
} from "../dist/authoring/types.js";
import { validateEntry } from "../dist/registry/entry_validation.js";
import { prepareRegistry } from "../dist/registry/prepare.js";

import {
  allViolations,
  assertViolation,
  config,
  flowWithVariant,
  invalidNonScreen,
  screenDefinitions,
  sourceRelativePath,
  variant,
  variantDefinitions,
} from "./variant_validation_fixture.js";

test("variant authoring rejects only the retained forbidden fields", () => {
  for (const field of ["variants", "navPath"] as const) {
    const input = {
      ...variant(`welcome-${field}`),
      [field]: [],
    };
    assertViolation(
      allViolations(screenDefinitions([input])),
      "invalid-variants",
      `welcome-${field}`,
    );
  }

  const legacy = {
    ...variant("welcome-legacy"),
    route: "screens/custom.html",
    slug: "custom",
  } as unknown as ScreenVariantInput;
  const definitions = screenDefinitions([legacy]);
  assert.equal(Object.hasOwn(definitions[1] ?? {}, "route"), false);
  assert.equal(
    allViolations(definitions).some(({ code }) => code === "invalid-variants"),
    false,
  );
});

for (const kind of ["screen", "component"] as const) {
  test(`${kind} variant relationships reject unknown, nested, and wrong-kind parents`, () => {
    const [parent, child] = variantDefinitions(kind);
    assert.ok(parent && child);
    const unknown = { ...child, variantOf: "missing" };
    assertViolation(
      allViolations([parent, unknown]),
      "invalid-variant-of",
      child.id,
    );
    const nested = {
      ...child,
      id: `${parent.id}-nested`,
      variantOf: child.id,
    } as ResolvedRegistryEntry;
    assertViolation(
      allViolations([parent, child, nested]),
      "invalid-variant-of",
      nested.id,
    );
    const wrongParent = {
      ...invalidNonScreen("page"),
      id: "page-parent",
    } as ResolvedRegistryEntry;
    const childOfPage = {
      ...child,
      variantOf: "page-parent",
    } as ResolvedRegistryEntry;
    assertViolation(
      allViolations([wrongParent, childOfPage]),
      "invalid-variant-of",
      child.id,
    );
  });

  test(`${kind} variants retain their parent's navigation path`, () => {
    const [parent, child] = variantDefinitions(kind);
    assert.ok(parent && child);
    const moved = { ...child, navPath: ["Elsewhere"] };
    assertViolation(
      allViolations([parent, moved]),
      "invalid-variants",
      child.id,
    );
  });
}

test("component parents require at least one variant", () => {
  const [parent] = variantDefinitions("component");
  assert.ok(parent);
  assertViolation(allViolations([parent]), "invalid-variants", parent.id);
});

for (const [field, value] of [
  ["dependencies", ["README.md"]],
  ["relatedDocs", ["README.md"]],
  ["colorSchemes", ["light"]],
  ["tags", ["forms"]],
] as const)
  test(`component variants inherit ${field} from their parent`, () => {
    const [parent, child] = variantDefinitions("component");
    assert.ok(parent && child);
    assert.throws(
      () => prepareRegistry([parent, { ...child, [field]: value }], config),
      new RegExp(`must inherit ${field}`),
    );
  });

test("non-screen entries reject variant fields even when undefined", () => {
  for (const kind of ["page", "use-case", "component"] as const) {
    const violations = validateEntry(invalidNonScreen(kind), config);
    assert.equal(
      violations.filter(({ code }) => code === "invalid-variants").length,
      kind === "component" ? 1 : 2,
      kind,
    );
    assert.ok(
      violations.every(
        ({ sourceRelativePath: source }) => source === sourceRelativePath,
      ),
    );
  }
});

test("omitted variant use-case membership does not inherit from its parent", () => {
  const prepared = prepareRegistry(flowWithVariant(), config);

  assert.equal(prepared.entries.length, 3);
});

test("declared variant use-case membership remains reciprocal", () => {
  assert.throws(() => prepareRegistry(flowWithVariant(["tour"]), config), {
    code: "build-invalid",
    message: /\[missing-step\].*welcome-empty/,
  });
});
