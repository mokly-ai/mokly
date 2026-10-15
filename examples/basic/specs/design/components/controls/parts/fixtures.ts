import {
  actionParent,
  actionVariants,
  type ActionEntry,
  type ActionProps,
} from "../../parts/action_props.js";

export type ControlsState =
  | "parent"
  | "default"
  | "edited"
  | "unset"
  | "variant"
  | "reset"
  | "pending"
  | "preparing"
  | "preparing-failed"
  | "invalid"
  | "error"
  | "comparison"
  | "readonly"
  | "readonly-variant"
  | "invalid-together"
  | "expired";

interface ControlsFixture {
  variant: ActionEntry;
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
  parent: {
    variant: "parent",
    draft: actionParent.props,
    preview: actionParent.props,
    edited: false,
  },
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
  preparing: {
    variant: "default",
    draft: saved,
    preview: saved,
    edited: false,
  },
  "preparing-failed": {
    variant: "default",
    draft: saved,
    preview: saved,
    edited: false,
  },
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
  "invalid-together": {
    variant: "default",
    draft: { ...saved, disabled: true, emphasis: "quiet" },
    preview: saved,
    edited: true,
  },
  expired: { variant: "default", draft: edited, preview: saved, edited: true },
};

export function isPublished(state: ControlsState): boolean {
  return state === "readonly" || state === "readonly-variant";
}
