import type { ReactNode } from "react";

import { ControlsPanel } from "../../../../../../packages/ui/src/controls-panel/controls-panel.js";
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
 * prop is optional and the variant leaves it out, and the native input that
 * holds the variant's value.
 */
interface VariantField {
  name: string;
  label: string;
  description?: string | undefined;
  optional?: boolean | undefined;
  unset?: boolean | undefined;
  input: (id: string) => ReactNode;
}

/**
 * The Action's controls in the order of its definition in
 * `examples/basic/src/components/action`, with its saved variant Disabled's
 * values. The disabled flag, the corner radius, and the hint are optional,
 * and Disabled leaves out the hint.
 */
const ACTION_DISABLED: readonly VariantField[] = [
  {
    name: "label",
    label: "Label",
    input: (id) => (
      <input defaultValue="Continue" id={id} maxLength={80} type="text" />
    ),
  },
  {
    name: "disabled",
    label: "Disabled",
    optional: true,
    input: (id) => <input defaultChecked id={id} type="checkbox" />,
  },
  {
    name: "radius",
    label: "Corner radius",
    description: CONTROLS_COPY.range(0, 32, 1),
    optional: true,
    input: (id) => (
      <input
        aria-describedby={`${id}-help`}
        defaultValue={8}
        id={id}
        max={32}
        min={0}
        step={1}
        type="number"
      />
    ),
  },
  {
    name: "tone",
    label: "Emphasis",
    input: (id) => (
      <select defaultValue="primary" id={id}>
        <option value="primary">Primary</option>
        <option value="secondary">Secondary</option>
      </select>
    ),
  },
  {
    name: "hint",
    label: "Hint",
    optional: true,
    unset: true,
    input: (id) => (
      <input defaultValue="" id={id} maxLength={120} type="text" />
    ),
  },
];

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
 * The shipped edit form of one saved variant: its title with its saved
 * props, Reset, which stays disabled until a prop changes, and its fields,
 * each in the registered prop field around its native input.
 */
function VariantControls({
  fields,
  id,
  title,
}: {
  fields: readonly VariantField[];
  /** The prefix of the fields' ids, unique in the document. */
  id: string;
  title: string;
}) {
  const scope = useDesignInstance(id);
  return (
    <ControlsPanel
      dirty={false}
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
