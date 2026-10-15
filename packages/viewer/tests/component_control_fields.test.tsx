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
