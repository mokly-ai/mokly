import assert from "node:assert/strict";
import test from "node:test";

import { VARIANT_PARENT } from "../dist/authoring/markers.js";
import { defineComponent } from "../dist/components/definition.js";

import { pathFixture } from "./helpers/path_fixture.js";

const input = {
  path: "action",
  title: "Action",
  description: "A shared action",

  relatedDocs: ["docs/action.md"],
  tags: ["forms"],
  colorSchemes: ["light", "dark"],
  propSchema: {
    kind: "object",
    properties: { label: { schema: { kind: "string" } } },
  },
  slots: ["children"],
  render: () => null,
} as const;

test("component flattening retains the parent reference, inherited metadata and slot names", () => {
  const registration = defineComponent({
    ...input,
    variants: [
      {
        slug: "primary",
        title: "Primary",
        props: { label: "Continue", children: <span>Next</span> },
      },
      {
        slug: "disabled",
        title: "Disabled",
        description: "The unavailable state",
        props: { label: "Continue" },
      },
    ],
  });
  const [parent, first, second] = registration.entries;
  assert.ok(first && second);
  assert.equal(registration.entries.length, 3);
  assert.equal("entry" in registration, false);
  assert.equal("variants" in parent, false);
  assert.equal("variantOf" in parent, false);
  assert.equal(first[VARIANT_PARENT], parent);
  assert.equal(first.slug, "primary");
  assert.equal(first.path, undefined);
  for (const field of ["relatedDocs", "tags", "colorSchemes"] as const)
    assert.deepEqual(first[field], parent[field]);
  assert.equal(Object.hasOwn(first, "dependencies"), false);
  assert.deepEqual(first.suppliedSlots, ["children"]);
  assert.equal(first.description, parent.description);
  assert.equal(second.description, "The unavailable state");
  assert.equal(second.slug, "disabled");
});

test("component variant path grammar is validated after module-derived parent identity", async (t) => {
  const fixture = await pathFixture({
    "specs/library/action.mockup.ts": componentSource(
      "{slug:'con',title:'Reserved',props:{}}",
    ),
  });
  t.after(fixture.remove);
  await assert.rejects(fixture.compile(), /\[invalid-segment\].*con/);
});

test("components require saved variants immediately", () => {
  assert.throws(
    () => defineComponent({ ...input, variants: [] }),
    /at least one saved variant is required/,
  );
});

for (const field of [
  "path",
  "colorSchemes",
  "dependencies",
  "navPath",
  "relatedDocs",
  "tags",
  "variantOf",
  "variants",
  "unexpected",
]) {
  test(`component variant ${field} ${field === "dependencies" ? "warns" : "is rejected"} with the final parent path`, async (t) => {
    const fixture = await pathFixture({
      "specs/library/action.mockup.ts": componentSource(
        `{slug:'primary',title:'Primary',props:{},${field}:undefined}`,
      ),
    });
    t.after(fixture.remove);
    if (field === "dependencies") {
      const built = await fixture.compile();
      assert.deepEqual(
        built.diagnostics?.map(({ code, subject }) => ({ code, subject })),
        [
          {
            code: "removed-dependencies",
            subject: { kind: "entry", path: "library/action/primary" },
          },
        ],
      );
      assert.ok(
        built.manifest.entries.every(
          (entry) => !Object.hasOwn(entry, "dependencies"),
        ),
      );
      return;
    }
    await assert.rejects(
      fixture.compile(),
      new RegExp(
        `\\[invalid-field\\].*\\(library/action/primary\\): unknown field ${field}`,
      ),
    );
  });
}

function componentSource(variant: string): string {
  return `import {defineComponent} from '@mokly/mokly'; export default defineComponent({title:'Action',description:'An action',relatedDocs:[],propSchema:{kind:'object',properties:{}},render:()=> 'Action',variants:[${variant}]});`;
}
