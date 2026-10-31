import { PropValues } from "../../../../../../packages/ui/src/props-panel/props-panel.js";
import { CONTROLS_COPY } from "../controls/parts/copy.js";
/** Shared, typed fixture inputs for saved examples and controls designs. */
export interface ActionProps {
  label: string;
  disabled: boolean;
  cornerRadius: number;
  emphasis: "strong" | "quiet";
  hint?: string;
}

export type ActionVariant = "default" | "disabled";

/** Each named variant supplies a complete preset; temporary edits never mutate it. */
export const actionVariants: Record<
  ActionVariant,
  { title: string; props: ActionProps }
> = {
  default: {
    title: "Default",
    props: {
      label: "Continue",
      disabled: false,
      cornerRadius: 8,
      emphasis: "strong",
      hint: "Go to the next step",
    },
  },
  disabled: {
    title: "Disabled",
    props: {
      label: "Continue",
      disabled: true,
      cornerRadius: 8,
      emphasis: "strong",
      hint: "The next step is unavailable",
    },
  },
};

/** The parent's own entry or one of its saved variants. */
export type ActionEntry = "parent" | ActionVariant;

/**
 * Action's own entry holds the keys that every saved variant sets, with
 * Default's values. Secondary sets no hint, so the parent has none.
 */
export const actionParent: { title: string; props: ActionProps } = {
  title: "Action",
  props: {
    label: "Continue",
    disabled: false,
    cornerRadius: 8,
    emphasis: "strong",
  },
};

export const actionEntries: Record<
  ActionEntry,
  { title: string; props: ActionProps }
> = { parent: actionParent, ...actionVariants };

/** The removed Compact variant's saved props, readable but not editable. */
export const actionCompact: { title: string; props: ActionProps } = {
  title: "Compact",
  props: {
    label: "Continue",
    disabled: false,
    cornerRadius: 4,
    emphasis: "strong",
  },
};

/** Action's props in their declared order. */
const ACTION_PROPS: readonly (keyof ActionProps)[] = [
  "label",
  "disabled",
  "cornerRadius",
  "emphasis",
  "hint",
];

/** Action's supplied props in the shipped list, an unset one as Not set. */
export function ActionPropValues({ props }: { props: ActionProps }) {
  return (
    <PropValues
      values={ACTION_PROPS.map((name) => ({
        name,
        value:
          props[name] === undefined
            ? CONTROLS_COPY.notSet
            : JSON.stringify(props[name]),
      }))}
    />
  );
}
