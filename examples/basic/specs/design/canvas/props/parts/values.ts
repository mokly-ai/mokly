import {
  ACTION_SAVED,
  type ActionValues,
} from "../../parts/component_props.js";

/** Default's saved props, which the Props states edit. */
export const DEFAULT_SAVED: ActionValues = ACTION_SAVED.default;

/**
 * Default's props in each depicted state of an edit. Each edit keeps the
 * Action's real controls: its labels, its bounds, and its options.
 */
export const DEFAULT_EDITS = {
  /** Label, Corner radius, and Emphasis edited. */
  edited: {
    ...DEFAULT_SAVED,
    label: "Get started",
    radius: 16,
    tone: "secondary",
  },
  /** The optional hint unset, which differs from an empty hint. */
  unset: {
    label: DEFAULT_SAVED.label,
    disabled: DEFAULT_SAVED.disabled,
    radius: DEFAULT_SAVED.radius,
    tone: DEFAULT_SAVED.tone,
  },
  /**
   * A later edit of the label after the edited props rendered, whose render
   * failed.
   */
  later: {
    ...DEFAULT_SAVED,
    label: "Start now",
    radius: 16,
    tone: "secondary",
  },
  /** A corner radius above its maximum of 32. */
  invalid: { ...DEFAULT_SAVED, radius: 40 },
  /** Values that are each valid but fail together. */
  together: { ...DEFAULT_SAVED, disabled: true, tone: "secondary" },
} as const satisfies Record<string, ActionValues>;
