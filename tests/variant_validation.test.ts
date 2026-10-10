import assert from "node:assert/strict";
import test from "node:test";

import {
  __attributeDefinition,
  defineScreen,
} from "../dist/authoring/definitions.js";
import type { ResolvedRegistryEntry } from "../dist/authoring/types.js";
import { defineComponent } from "../dist/components/definition.js";
import { validateEntry } from "../dist/registry/entry_validation.js";
import { collectModuleExports } from "../dist/registry/export_collection.js";
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
} from "./helpers/variant_validation.js";

test("variant authoring rejects only the retained forbidden fields", () => {
  for (const field of ["variants", "variantOf"] as const) {
    const input = {
      ...variant(field),
      [field]: [],
    };
    assertViolation(
      allViolations(screenDefinitions([input])),
      field === "variants" ? "invalid-variants" : "invalid-field",
      `welcome/${field}`,
    );
  }

  const unknown = { ...variant("unknown"), route: "custom/index.html" };
  assertViolation(
    allViolations(screenDefinitions([unknown])),
    "invalid-field",
    "welcome/unknown",
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
      child.path,
    );
    const nested = {
      ...child,
      path: `${parent.path}-nested`,
      variantOf: child.path,
    } as ResolvedRegistryEntry;
    assertViolation(
      allViolations([parent, child, nested]),
      "invalid-variant-of",
      nested.path,
    );
    const wrongParent = {
      ...invalidNonScreen("page"),
      path: "page-parent",
    } as ResolvedRegistryEntry;
    const childOfPage = {
      ...child,
      variantOf: "page-parent",
    } as ResolvedRegistryEntry;
    assertViolation(
      allViolations([wrongParent, childOfPage]),
      "invalid-variant-of",
      child.path,
    );
  });

  test(`${kind} variant paths are the parent path followed by their slug`, () => {
    const common = {
      path: "account/invoice",
      title: "Invoice",
      description: "Invoice",

      relatedDocs: [],
    };
    const authored =
      kind === "screen"
        ? defineScreen({
            ...common,
            mobile: "Invoice",
            desktop: "Invoice",
            variants: [variant("index")],
          })
        : defineComponent({
            ...common,
            propSchema: { kind: "object", properties: {} },
            render: () => null,
            variants: [{ slug: "index", title: "Index", props: {} }],
          }).entries;
    const entries = prepareRegistry(
      collectModuleExports(
        { default: __attributeDefinition(authored, sourceRelativePath) },
        sourceRelativePath,
      ),
      config,
    ).entries;
    assert.deepEqual(
      entries.map((entry) => entry.path),
      ["account/invoice", "account/invoice/index"],
    );
    const child = entries[1]!;
    assert.equal(
      "variantOf" in child ? child.variantOf : undefined,
      "account/invoice",
    );
    assert.equal(child.index, false);
    assert.deepEqual(allViolations(entries), []);
  });
}

test("component parents require at least one variant", () => {
  const [parent] = variantDefinitions("component");
  assert.ok(parent);
  assertViolation(allViolations([parent]), "invalid-variants", parent.path);
});

for (const [field, value] of [
  ["relatedDocs", ["README.md"]],
  ["colorSchemes", ["light"]],
  ["tags", ["forms"]],
] as const)
  test(`component variants inherit ${field} from their parent`, () => {
    const [parent, child] = variantDefinitions("component");
    assert.ok(parent && child);
    assert.throws(
      () =>
        prepareRegistry(
          collectModuleExports(
            { default: [parent, Object.assign(child, { [field]: value })] },
            sourceRelativePath,
          ),
          config,
        ),
      new RegExp(`must inherit ${field}`),
    );
  });

test("removed component and variant dependencies warn without inheritance or validation", () => {
  const [parent, child] = variantDefinitions("component");
  assert.ok(parent && child);
  const removed = { dependencies: ["README.md"] } as Record<string, unknown>;
  const prepared = prepareRegistry(
    collectModuleExports(
      {
        default: [
          Object.assign(parent, removed),
          Object.assign(child, removed),
        ],
      },
      sourceRelativePath,
    ),
    config,
  );
  assert.deepEqual(
    prepared.diagnostics.map(({ code, subject }) => [code, [subject?.path]]),
    [
      ["removed-dependencies", [parent.path]],
      ["removed-dependencies", [child.path]],
    ],
  );
  assert.ok(
    prepared.entries.every((entry) => !Object.hasOwn(entry, "dependencies")),
  );
});

test("non-screen entries reject variant fields even when undefined", () => {
  for (const kind of ["page", "use-case", "component"] as const) {
    const violations = validateEntry(invalidNonScreen(kind), config);
    assert.equal(
      violations.filter(({ code }) => code === "invalid-field").length,
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
  const prepared = prepareRegistry(
    collectModuleExports({ default: flowWithVariant() }, sourceRelativePath),
    config,
  );

  assert.equal(prepared.entries.length, 3);
});

test("declared variant use-case membership remains reciprocal", () => {
  assert.throws(
    () =>
      prepareRegistry(
        collectModuleExports(
          { default: flowWithVariant(["tour"]) },
          sourceRelativePath,
        ),
        config,
      ),
    {
      code: "build-invalid",
      message: /\[missing-step\].*welcome\/empty/,
    },
  );
});
