/**
 * A browser entry of `prop_field_invalid.spec.ts`: a valid text field, and an
 * invalid number field and select, as the Props tab draws them.
 */

import { renderToStaticMarkup } from "react-dom/server";

import { PropField, PropFields } from "@mokly/ui/prop-field";

const WORDING = { notSet: "Not set", optional: "Optional", set: "Set" };

document.body.innerHTML = renderToStaticMarkup(
  <PropFields>
    <PropField
      control={{ kind: "text" }}
      description=""
      disabled={false}
      id="field-label"
      label="label"
      name="label"
      optional={false}
      supplied
      value="Continue"
      wording={WORDING}
    />
    <PropField
      control={{ kind: "number", max: 24, min: 0, step: 1 }}
      description=""
      disabled={false}
      error="Use a number from 0 to 24."
      id="field-radius"
      label="cornerRadius"
      name="cornerRadius"
      optional={false}
      supplied
      value="99"
      wording={WORDING}
    />
    <PropField
      control={{
        kind: "select",
        options: ["strong", "quiet"],
        placeholder: "Choose a value",
      }}
      description=""
      disabled={false}
      error="Choose strong or quiet."
      id="field-emphasis"
      label="emphasis"
      name="emphasis"
      optional={false}
      supplied
      value="0"
      wording={WORDING}
    />
  </PropFields>,
);
document.body.dataset["rendered"] = "";
