import assert from "node:assert/strict";
import test from "node:test";

import { defineComponent } from "../dist/components/definition.js";

test("defineComponent flattens global component variants after their parent", () => {
  const registration = defineComponent({
    id: "action",
    title: "Action",
    description: "A shared action",
    navPath: ["Shared"],
    dependencies: ["src/action.tsx"],
    relatedDocs: ["docs/action.md"],
    tags: ["forms"],
    colorSchemes: ["light", "dark"],
    propSchema: {
      kind: "object",
      properties: { label: { schema: { kind: "string" } } },
    },
    slots: ["children"],
    render: (props) => (
      <button>
        {props.label}
        {props.children}
      </button>
    ),
    variants: [
      {
        id: "action-default",
        title: "Default",
        props: { label: "Continue", children: <span>Next</span> },
      },
      {
        id: "action-disabled",
        title: "Disabled",
        description: "The unavailable state",
        props: { label: "Continue" },
      },
    ],
  });

  assert.equal("entry" in registration, false);
  assert.equal(registration.entries.length, 3);
  const [parent, first, second] = registration.entries;
  assert.ok(parent && first && second);
  assert.equal(parent.id, "action");
  assert.equal("variants" in parent, false);
  assert.equal("variantOf" in parent, false);
  assert.equal(first.id, "action-default");
  assert.equal(first.variantOf, "action");
  assert.deepEqual(first.navPath, ["Shared"]);
  assert.deepEqual(first.dependencies, ["src/action.tsx"]);
  assert.deepEqual(first.relatedDocs, ["docs/action.md"]);
  assert.deepEqual(first.tags, ["forms"]);
  assert.deepEqual(first.colorSchemes, ["light", "dark"]);
  assert.deepEqual(first.suppliedSlots, ["children"]);
  assert.equal(first.description, "A shared action");
  assert.equal(second.id, "action-disabled");
  assert.equal(second.description, "The unavailable state");
});

test("defineComponent applies the global id grammar to variant ids", () => {
  const input = {
    id: "action",
    title: "Action",
    description: "A shared action",
    dependencies: [],
    relatedDocs: [],
    propSchema: { kind: "object", properties: {} },
    render: () => null,
  } as const;

  assert.throws(
    () =>
      defineComponent({
        ...input,
        variants: [{ id: "con", title: "Reserved", props: {} }],
      }),
    /variant id must be globally unique kebab-case/,
  );
  assert.throws(
    () =>
      defineComponent({
        ...input,
        variants: [
          {
            id: "action-default",
            title: "Default",
            props: {},
            navPath: undefined,
          } as never,
        ],
      }),
    /unknown variant field navPath/,
  );
});
