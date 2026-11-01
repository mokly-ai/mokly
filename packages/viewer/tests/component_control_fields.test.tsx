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
    /<label class="mbk-control-label mbk-reset" for="mb-prop-components\/action-label">label <span aria-hidden="true" class="mbk-control-optional mbk-reset">Optional<\/span><\/label><div class="mbk-control-value mbk-reset"><label class="mbk-control-set mbk-reset"><input class="mbk-reset" type="checkbox"\/><span class="mbk-reset">Set label<\/span><\/label><input[^>]*hidden=""[^>]*\/><p class="mbk-control-unset mbk-reset">Not set<\/p>/,
  );
  const set = fields(target);
  assert.match(
    set,
    /<input class="mbk-reset" type="checkbox" checked=""\/><span class="mbk-reset">Set label<\/span>/,
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
    /<small class="mbk-reset"( hidden="")? id="[^"]*-help">([^<]*)<\/small>/.exec(
      html,
    );
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
    /<small class="mbk-control-error mbk-reset" id="[^"]*-error">Enter up to 3 characters\.<\/small>/,
  );
});

test("a field names only its visible help or error as its description", () => {
  const radius: ControlTarget = {
    ...target,
    propSchema: {
      type: "object",
      additionalProperties: false,
      required: ["radius", "label"],
      properties: { radius: { type: "number" }, label: { type: "string" } },
    } as unknown as PropSchema,
    props: encodeProps({ radius: 4, label: "Go" }),
    controls: {
      radius: { kind: "number", minimum: 0, maximum: 24 },
      label: { kind: "text" },
    },
  };
  const described = (html: string, name: string) =>
    new RegExp(
      `<input[^>]*aria-describedby="([^"]*)"[^>]*data-prop-control="${name}"`,
    ).exec(html)?.[1];
  const quiet = fields(radius);
  assert.match(described(quiet, "radius") ?? "", /-radius-help$/);
  assert.equal(described(quiet, "label"), undefined);
  const invalid = fields(radius, { radius: "Enter a number from 0 to 24." });
  assert.match(described(invalid, "radius") ?? "", /-radius-error$/);
});

test("an optional toggle names its value check box; a required one keeps its label", () => {
  const toggle = (required: boolean, value?: boolean): ControlTarget => ({
    ...target,
    propSchema: {
      type: "object",
      additionalProperties: false,
      required: required ? ["muted"] : [],
      properties: { muted: { type: "boolean", title: "Muted" } },
    } as unknown as PropSchema,
    props: encodeProps(value === undefined ? {} : { muted: value }),
    controls: { muted: { kind: "boolean" } },
  });
  const set = fields(toggle(false, true));
  assert.match(
    set,
    /^<div class="mbk-control-rows mbk-reset"><div class="mbk-control-field mbk-reset"><span class="mbk-control-label mbk-reset">Muted <span aria-hidden="true" class="mbk-control-optional mbk-reset">Optional<\/span><\/span><div class="mbk-control-value mbk-reset"><label class="mbk-control-set mbk-reset"><input class="mbk-reset" type="checkbox" checked=""\/><span class="mbk-reset">Set Muted<\/span><\/label><label class="mbk-control-check mbk-reset"><input data-prop-control="muted" id="mb-prop-components\/action-muted" class="mbk-reset" type="checkbox" checked=""\/><span class="mbk-reset">Muted<\/span><\/label>/,
  );
  assert.doesNotMatch(set, /<label[^>]* for=/);
  assert.match(
    fields(toggle(false)),
    /<label class="mbk-control-check mbk-reset" hidden="">.*<span class="mbk-reset">Muted<\/span><\/label><p class="mbk-control-unset mbk-reset">Not set<\/p>/,
  );
  const required = fields(toggle(true, false));
  assert.match(
    required,
    /<label class="mbk-control-label mbk-reset" for="mb-prop-components\/action-muted">Muted<\/label><div class="mbk-control-value mbk-reset"><input data-prop-control="muted"/,
  );
  assert.doesNotMatch(required, /mbk-control-check|Optional/);
});

test("help reads negative bounds with words and uses effective control bounds", () => {
  const help = (property: Record<string, unknown>, control: object) =>
    /<small class="mbk-reset"( hidden="")? id="[^"]*-help">([^<]*)<\/small>/.exec(
      fields({
        ...target,
        propSchema: {
          type: "object",
          additionalProperties: false,
          required: ["count"],
          properties: { count: property },
        } as unknown as PropSchema,
        props: encodeProps({ count: 4 }),
        controls: { count: { kind: "number", ...control } },
      }),
    )?.[2];
  assert.equal(
    help({ type: "number" }, { minimum: -10, maximum: -1 }),
    "-10 to -1",
  );
  assert.equal(
    help({ type: "number" }, { minimum: -5, maximum: 5 }),
    "-5 to 5",
  );
  assert.equal(
    help(
      { type: "integer", minimum: 1, maximum: 9, multipleOf: 2 },
      { minimum: 1, maximum: 9, step: 2 },
    ),
    "2–8 in steps of 2",
  );
  assert.equal(
    help({ type: "integer", minimum: 0 }, { minimum: 0, step: 1 }),
    "0 or more",
  );
});

test("each field is a row: its name in the label column, then its value", () => {
  const markup = fields(target);
  assert.match(
    markup,
    /^<div class="mbk-control-rows mbk-reset">(<div class="mbk-control-field mbk-reset"><(label|span) class="mbk-control-label mbk-reset"[^>]*>.*?<\/(label|span)><div class="mbk-control-value mbk-reset">.*?<\/div><\/div>)+<\/div>$/,
  );
  assert.doesNotMatch(markup, /mbk-control-grid|mbk-control-name/);
});
