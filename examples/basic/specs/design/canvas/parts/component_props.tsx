import type { ReactNode } from "react";

import {
  ControlsPanel,
  type ControlsAlert,
  type ControlsStart,
} from "../../../../../../packages/ui/src/controls-panel/controls-panel.js";
import { PropFields } from "../../../../../../packages/ui/src/prop-field/prop-field.js";
import { PropsMessage } from "../../../../../../packages/ui/src/props-panel/props-panel.js";
import { CONTROLS_COPY } from "../../components/controls/parts/copy.js";
import { optional, useDesignInstance } from "../../library/composition.js";
import { propField } from "../../library/inspector/prop-field.js";
import { TOOLBAR_DEFAULT } from "../../parts/mini_toolbar.js";

/**
 * The Props section of a variant set while no frame is selected: the set
 * shows every variant, so the reader chooses one to edit.
 */
export function ChooseVariant() {
  return <PropsMessage>Choose a variant to edit its props.</PropsMessage>;
}

/**
 * One field of a saved variant's edit form, as the component's definition
 * declares its control: the prop, the control's label, its help, whether the
 * prop is optional and the variant leaves it out, why its value is not
 * valid, and the native input that holds the variant's value.
 */
export interface VariantField {
  name: string;
  label: string;
  description?: string | undefined;
  optional?: boolean | undefined;
  unset?: boolean | undefined;
  error?: string | undefined;
  input: (id: string) => ReactNode;
}

/**
 * The values of the Action's props that a saved variant or an edit holds. An
 * optional prop that the values leave out is unset.
 */
export interface ActionValues {
  label: string;
  disabled?: boolean | undefined;
  radius?: number | undefined;
  tone: "primary" | "secondary";
  hint?: string | undefined;
}

/** The saved props of the Action's saved variants Default and Disabled. */
export const ACTION_SAVED = {
  default: {
    label: "Continue",
    disabled: false,
    radius: 8,
    tone: "primary",
    hint: "Continue when you’re ready.",
  },
  disabled: { label: "Continue", disabled: true, radius: 8, tone: "primary" },
} as const satisfies Record<string, ActionValues>;

/** The bounds of the Action's corner radius, as its control declares them. */
const RADIUS = { minimum: 0, maximum: 32, step: 1 } as const;

/**
 * The Action's controls in the order of its definition in
 * `examples/basic/src/components/action`, holding the given values. The
 * disabled flag, the corner radius, and the hint are optional. A corner
 * radius outside its bounds keeps the entered value with its error.
 */
export function actionFields(
  values: ActionValues,
  invalid: { radius?: boolean } = {},
): readonly VariantField[] {
  const radiusError = invalid.radius
    ? CONTROLS_COPY.numberError(RADIUS.minimum, RADIUS.maximum, RADIUS.step)
    : undefined;
  return [
    {
      name: "label",
      label: "Label",
      input: (id) => (
        <input defaultValue={values.label} id={id} maxLength={80} type="text" />
      ),
    },
    {
      name: "disabled",
      label: "Disabled",
      optional: true,
      unset: values.disabled === undefined,
      input: (id) => (
        <input
          defaultChecked={values.disabled ?? false}
          id={id}
          type="checkbox"
        />
      ),
    },
    {
      name: "radius",
      label: "Corner radius",
      description: CONTROLS_COPY.range(
        RADIUS.minimum,
        RADIUS.maximum,
        RADIUS.step,
      ),
      optional: true,
      unset: values.radius === undefined,
      error: radiusError,
      input: (id) => (
        <input
          aria-describedby={
            radiusError === undefined ? `${id}-help` : `${id}-error`
          }
          aria-invalid={radiusError === undefined ? undefined : "true"}
          defaultValue={values.radius ?? ""}
          id={id}
          max={RADIUS.maximum}
          min={RADIUS.minimum}
          step={RADIUS.step}
          type="number"
        />
      ),
    },
    {
      name: "tone",
      label: "Emphasis",
      input: (id) => (
        <select defaultValue={values.tone} id={id}>
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
        </select>
      ),
    },
    {
      name: "hint",
      label: "Hint",
      optional: true,
      unset: values.hint === undefined,
      input: (id) => (
        <input
          defaultValue={values.hint ?? ""}
          id={id}
          maxLength={120}
          type="text"
        />
      ),
    },
  ];
}

/** The Action's controls with its saved variant Disabled's values. */
const ACTION_DISABLED = actionFields(ACTION_SAVED.disabled);

/** The Toolbar's one control, Title, with its saved variant Default's value. */
const TOOLBAR_DEFAULT_FIELDS: readonly VariantField[] = [
  {
    name: "title",
    label: "Title",
    input: (id) => (
      <input
        defaultValue={TOOLBAR_DEFAULT.title}
        id={id}
        maxLength={80}
        type="text"
      />
    ),
  },
];

/** The fields that Props counts while it edits each depicted variant. */
export const VARIANT_FIELDS = {
  "action-disabled": ACTION_DISABLED.length,
  "toolbar-default": TOOLBAR_DEFAULT_FIELDS.length,
} as const;

/**
 * The state of an edit form: whether its props differ from the saved props,
 * the alert above its fields, the status after a reset, and the start of
 * editing. A static artboard runs no script, so Reset, the alert's action,
 * and the action of a failed start each open the artboard of their outcome.
 */
export interface VariantEdit {
  dirty?: boolean | undefined;
  alert?: ControlsAlert | undefined;
  restored?: string | undefined;
  start?: ControlsStart | undefined;
  resetHref?: string | undefined;
  retryHref?: string | undefined;
  startHref?: string | undefined;
}

/**
 * The shipped edit form of one saved variant: its title with its saved
 * props, Reset, which stays disabled until a prop changes, and its fields,
 * each in the registered prop field around its native input. The edit's
 * state adds the badge of edited props, an alert, the reset status, or the
 * start of editing, which keeps the fields read-only.
 */
export function VariantControls({
  edit = {},
  fields,
  id,
  title,
}: {
  edit?: VariantEdit | undefined;
  fields: readonly VariantField[];
  /** The prefix of the fields' ids, unique in the document. */
  id: string;
  title: string;
}) {
  const scope = useDesignInstance(id);
  return (
    <ControlsPanel
      dirty={edit.dirty ?? false}
      {...optional("alert", edit.alert)}
      {...optional("restored", edit.restored)}
      {...optional("start", edit.start)}
      {...optional("resetHref", edit.resetHref)}
      {...optional("retryHref", edit.retryHref)}
      {...optional("startHref", edit.startHref)}
      title={title}
      wording={{
        edited: CONTROLS_COPY.edited,
        heading: CONTROLS_COPY.heading,
        reset: CONTROLS_COPY.reset(title),
        saved: CONTROLS_COPY.saved,
      }}
    >
      <PropFields>
        {fields.map((field) => {
          const inputId = `${id}-${field.name}`;
          return (
            <propField.Component
              key={field.name}
              moklyInstance={`${scope}-${field.name}`}
              label={field.label}
              inputId={inputId}
              optional={field.optional ?? false}
              supplied={!field.unset}
              {...optional("description", field.description)}
              {...optional("error", field.error)}
              control={field.input(inputId)}
            />
          );
        })}
      </PropFields>
    </ControlsPanel>
  );
}

/** The Action's edit form for its saved variant Disabled. */
export function ActionDisabledControls() {
  return (
    <VariantControls
      fields={ACTION_DISABLED}
      id="action-disabled"
      title="Disabled"
    />
  );
}

/** The Toolbar's edit form for its saved variant Default. */
export function ToolbarDefaultControls() {
  return (
    <VariantControls
      fields={TOOLBAR_DEFAULT_FIELDS}
      id="toolbar-default"
      title="Default"
    />
  );
}
