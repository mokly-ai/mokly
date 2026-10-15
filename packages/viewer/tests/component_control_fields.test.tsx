import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { encodeProps } from "../src/components/codec.js";
import type { PropSchema } from "../src/components/prop_types.js";
import {
  ComponentControlFields,
  controlDraft,
} from "../src/shell/component_control_fields.js";
import type { ControlTarget } from "../src/shell/control_values.js";

const target: ControlTarget = {
  path: "components/action",
  title: "Action",
  kind: "component",
  propSchema: {
    type: "object",
    additionalProperties: false,
    properties: { label: { type: "string", maxLength: 3 } },
  } as unknown as PropSchema,
  props: encodeProps({ label: "Go" }),
  controls: { label: { kind: "text", maxLength: 3 } },
  suppliedSlots: [],
  removed: false,
};

test("a text control sets no native length limit", () => {
  const html = renderToStaticMarkup(
    <ComponentControlFields
      disabled={false}
      draft={controlDraft(target)}
      errors={{}}
      onChange={() => undefined}
      target={target}
    />,
  );
  assert.match(html, /type="text"/);
  assert.match(html, /value="Go"/);
  assert.doesNotMatch(html, /maxlength/i);
});

function fields(
  shown: ControlTarget,
  errors: Readonly<Record<string, string>> = {},
) {
  return renderToStaticMarkup(
    <ComponentControlFields
      disabled={false}
      draft={controlDraft(shown)}
      errors={errors}
      onChange={() => undefined}
      target={shown}
    />,
  );
}

test("an optional field says Optional and Set {name}; unset, it shows Not set", () => {
  const optional: ControlTarget = {
    ...target,
    props: encodeProps({}),
  };
  const unset = fields(optional);
  assert.match(
    unset,
    /<label for="mb-prop-components\/action-label">label <span aria-hidden="true">Optional<\/span><\/label><label class="mbk-control-set"><input type="checkbox"\/><span>Set label<\/span><\/label><input[^>]*hidden=""[^>]*\/><p class="mbk-control-unset">Not set<\/p>/,
  );
  const set = fields(target);
  assert.match(
    set,
    /<input type="checkbox" checked=""\/><span>Set label<\/span>/,
  );
  assert.doesNotMatch(set, /Not set|hidden=""[^>]*value="Go"/);
  const required = fields({
    ...target,
    propSchema: { ...target.propSchema, required: ["label"] },
  });
  assert.doesNotMatch(required, /Optional|Set label|mbk-control-set/);
});

test("a number field's help names its bounds and step; an error replaces it", () => {
  const number = (control: Record<string, number>) =>
    fields({
      ...target,
      propSchema: {
        type: "object",
        additionalProperties: false,
        required: ["count"],
        properties: { count: { type: "number" } },
      } as unknown as PropSchema,
      props: encodeProps({ count: 4 }),
      controls: { count: { kind: "number", ...control } },
    });
  const help = (html: string) =>
    /<small( hidden="")? id="[^"]*-help">([^<]*)<\/small>/.exec(html);
  assert.equal(help(number({ minimum: 0, maximum: 24 }))?.[2], "0–24");
  assert.equal(help(number({ minimum: 0 }))?.[2], "0 or more");
  assert.equal(help(number({ maximum: 24 }))?.[2], "24 or less");
  assert.equal(help(number({}))?.[1], ' hidden=""');
  assert.equal(
    help(number({ minimum: 1, maximum: 9, step: 2 }))?.[2],
    "2–8 in steps of 2",
  );
  assert.equal(help(number({ step: 1 }))?.[1], ' hidden=""');
  const invalid = fields(
    {
      ...target,
      controls: { label: { kind: "text", maxLength: 3 } },
    },
    { label: "Enter up to 3 characters." },
  );
  assert.match(
    invalid,
    /<small class="mbk-control-error" id="[^"]*-error">Enter up to 3 characters\.<\/small>/,
  );
});
