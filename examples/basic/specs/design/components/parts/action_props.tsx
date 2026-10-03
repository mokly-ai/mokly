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
