import { MetaRow } from "../../parts/metadata_row.js";
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

const fieldIds: Record<keyof ActionProps, string> = {
  label: "label",
  disabled: "disabled",
  cornerRadius: "corner-radius",
  emphasis: "emphasis",
  hint: "hint",
};

export function ActionPropValues({ props }: { props: ActionProps }) {
  return (
    <dl className="ce-props" aria-label="Supplied props">
      {(Object.keys(fieldIds) as (keyof ActionProps)[]).map((key) => (
        <MetaRow
          key={key}
          name={fieldIds[key]}
          label={key}
          presentation="props"
        >
          <code>
            {props[key] === undefined ? "Not set" : JSON.stringify(props[key])}
          </code>
        </MetaRow>
      ))}
    </dl>
  );
}
