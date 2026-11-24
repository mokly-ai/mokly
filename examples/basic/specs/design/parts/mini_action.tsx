import type { CSSProperties } from "react";

/**
 * The example's Action component with its own props, `own`, or with the
 * props of one of its saved variants.
 */
export type MiniActionVariant = "default" | "disabled" | "own" | "secondary";

/** How a depicted Action's button looks: its emphasis, or disabled. */
export type MiniActionLook = "disabled" | "primary" | "secondary";

/**
 * The real button of the example's Action, as its built component document
 * measures it at the desktop size: 38px tall, with a 1px border and 16px
 * beside its label.
 */
export const ACTION_BUTTON = { height: 38, border: 1, padding: 16 } as const;

/**
 * The measured outer width of the real button with each label that a
 * component frame draws: its label, 13px bold in the documents' fallback
 * face, its padding, and its border. A component frame's sketch sets the
 * label's part of it on the label's box, because Geist has other widths, so
 * each button keeps its measured box.
 */
export const BUTTON_WIDTHS = {
  Continue: 99.73,
  "Go back": 92.56,
  "Get started": 117.7,
  "Browse details": 142.11,
  "Browse welcome": 156.63,
} as const;

/** The measured width of each hint, 13px with a 19.5px line. */
const HINT_WIDTHS: Readonly<Record<string, number>> = {
  "Continue when you’re ready.": 186.3,
};

/** Whether the built documents measure a button with this label. */
function measured(label: string): label is keyof typeof BUTTON_WIDTHS {
  return Object.hasOwn(BUTTON_WIDTHS, label);
}

/**
 * The box of a button's label in a component frame: the measured button
 * without its border and its padding, which the sketch draws around it.
 */
export function labelBox(label: string): CSSProperties | undefined {
  if (!measured(label)) return undefined;
  const inset = 2 * (ACTION_BUTTON.border + ACTION_BUTTON.padding);
  return { width: Math.round((BUTTON_WIDTHS[label] - inset) * 100) / 100 };
}

/** The props that a depicted Action's component document renders. */
interface MiniActionProps {
  label: string;
  look: MiniActionLook;
  hint?: string | undefined;
  /** The corner radius that the props set as the button's own style. */
  radius?: number | undefined;
}

/**
 * The props of the component's own example and of each saved variant in
 * `examples/basic/src/components/action`: its label, its look, and its hint.
 */
const VARIANTS: Record<MiniActionVariant, MiniActionProps> = {
  own: { label: "Continue", look: "primary" },
  default: {
    hint: "Continue when you’re ready.",
    label: "Continue",
    look: "primary",
  },
  disabled: { label: "Continue", look: "disabled" },
  secondary: { label: "Go back", look: "secondary" },
};

/**
 * The Action's component document with the given props, in the measured
 * layout of the built document at the desktop size: the button 24px from the
 * top left, at its measured box with 8px corners, and the hint 8px below it
 * where the props set one. A radius in the props replaces the corners. It
 * reads the preview tokens, so a dark frame draws it on the dark screen.
 * While a render of edits is in flight, the document is busy; the status
 * over the frame stays outside it, so it is announced.
 */
export function MiniActionDocument({
  busy = false,
  hint,
  label,
  look,
  radius,
}: MiniActionProps & { busy?: boolean | undefined }) {
  const hintWidth = hint === undefined ? undefined : HINT_WIDTHS[hint];
  return (
    <div
      aria-busy={busy ? "true" : undefined}
      className="mbk-shot mbk-shot--action"
    >
      <div className="mbk-shot-pad">
        <span
          className={`mbk-shot-action mbk-shot-action--${look}`}
          style={{
            ...labelBox(label),
            ...(radius === undefined ? {} : { borderRadius: radius }),
          }}
        >
          {label}
        </span>
        {hint === undefined ? null : (
          <p style={hintWidth === undefined ? undefined : { width: hintWidth }}>
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Miniature depiction of the Action component, with its own props or with
 * one saved variant's, as its component document renders it.
 */
export function MiniAction({ variant }: { variant: MiniActionVariant }) {
  return <MiniActionDocument {...VARIANTS[variant]} />;
}
