import {
  actionVariants,
  type ActionProps,
  type ActionVariant,
} from "../../parts/action_props.js";

export type ControlsState =
  | "default"
  | "edited"
  | "unset"
  | "variant"
  | "reset"
  | "pending"
  | "invalid"
  | "error"
  | "comparison"
  | "readonly"
  | "readonly-variant";

interface ControlsFixture {
  variant: ActionVariant;
  draft: ActionProps;
  preview: ActionProps;
  edited: boolean;
}

const saved = actionVariants.default.props;
const disabled = actionVariants.disabled.props;
const edited: ActionProps = {
  ...saved,
  label: "Get started",
  cornerRadius: 16,
  emphasis: "quiet",
};
const unset = { ...saved };
delete unset.hint;

/** Authored outcomes share inputs with the native fields and the rendered example. */
export const controlsFixtures: Record<ControlsState, ControlsFixture> = {
  default: { variant: "default", draft: saved, preview: saved, edited: false },
  edited: { variant: "default", draft: edited, preview: edited, edited: true },
  unset: { variant: "default", draft: unset, preview: unset, edited: true },
  variant: {
    variant: "disabled",
    draft: disabled,
    preview: disabled,
    edited: false,
  },
  reset: { variant: "default", draft: saved, preview: saved, edited: false },
  pending: { variant: "default", draft: edited, preview: saved, edited: true },
  invalid: {
    variant: "default",
    draft: { ...saved, cornerRadius: 40 },
    preview: saved,
    edited: true,
  },
  error: { variant: "default", draft: edited, preview: saved, edited: true },
  comparison: {
    variant: "default",
    draft: saved,
    preview: saved,
    edited: false,
  },
  readonly: { variant: "default", draft: saved, preview: saved, edited: false },
  "readonly-variant": {
    variant: "disabled",
    draft: disabled,
    preview: disabled,
    edited: false,
  },
};

export function isPublished(state: ControlsState): boolean {
  return state === "readonly" || state === "readonly-variant";
}
