import { Button } from "../entries/design/button.mockup";
import { causes, failureReference } from "../fixtures/product-states";

import { ErrorReference } from "./error-reference";
import { componentInput, componentMetadata } from "./metadata";

/**
 * What a control says when its own write is refused. The cause sits directly
 * above the control that made the write and the control is the way back, so
 * the operation is named by the control and the cause by the message, and a
 * failure can never stand beside a control that would do something else.
 *
 * Every settings control draws this one fragment rather than wording a failure
 * of its own; a cause the reader's own text produced belongs on that field
 * instead, which the registered input already draws. The fragment is still
 * what surrounds the control there, so the cause is optional: the field has
 * already said what to do, and repeating it above the control would say the
 * same thing twice. The reference stays, because Mokly still answered.
 *
 * Its own props are empty: every prop is optional, and the saved variants
 * differ by which of them they leave out, which a variant cannot do over a
 * parent value. The control arrives through a slot, which only a saved
 * variant or a screen fills.
 */
export const writeFailureInput = componentInput({
  ...componentMetadata(
    "Write failure",
    "A refused write: the cause above the control, and the control as the way back.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      cause: { type: "string" },
      reference: { type: "string" },
    },
  },
  props: {},
  slots: ["control"],
  controls: { cause: { kind: "text" }, reference: { kind: "text" } },
  render: ({ cause, reference, control }) => (
    <div className="fo-write-failure">
      {cause ? (
        <p className="fo-copy" role="alert">
          {cause}
        </p>
      ) : undefined}
      {control}
      {reference ? <ErrorReference reference={reference} /> : undefined}
    </div>
  ),
  variants: [
    {
      slug: "save",
      title: "Save refused",
      props: { cause: causes.busy, reference: failureReference },
      slots: {
        control: (
          <Button
            moklyInstance="write-failure-save"
            label="Try again"
            tone="primary"
            size="md"
          />
        ),
      },
    },
    {
      slug: "confirmation",
      title: "Confirmation refused",
      props: { cause: causes.permission, reference: failureReference },
      slots: {
        control: (
          <Button
            moklyInstance="write-failure-confirmation"
            label="Try again"
            tone="danger"
            size="md"
          />
        ),
      },
    },
    {
      slug: "answered",
      title: "Answered on the field",
      props: { reference: failureReference },
      slots: {
        control: (
          <Button
            moklyInstance="write-failure-answered"
            label="Continue with email"
            tone="primary"
            size="md"
          />
        ),
      },
    },
    {
      slug: "unreferenced",
      title: "Raised in the browser",
      props: { cause: causes.clipboard },
      slots: {
        control: (
          <Button
            moklyInstance="write-failure-unreferenced"
            label="Copy token"
            tone="primary"
            size="md"
          />
        ),
      },
    },
  ],
});
