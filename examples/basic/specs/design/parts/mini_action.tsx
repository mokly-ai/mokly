/** A saved variant of the example's Action component. */
export type MiniActionVariant = "default" | "disabled" | "secondary";

/**
 * The props of each saved variant in `examples/basic/src/components/action`:
 * its label, its tone, and its hint.
 */
const VARIANTS: Record<
  MiniActionVariant,
  { hint?: string; label: string; tone: "disabled" | "primary" | "secondary" }
> = {
  default: {
    hint: "Continue when you’re ready.",
    label: "Continue",
    tone: "primary",
  },
  disabled: { label: "Continue", tone: "disabled" },
  secondary: { label: "Go back", tone: "secondary" },
};

/**
 * Miniature depiction of one saved variant of the Action component, as its
 * component document renders it: the button 24px from the top left, and the
 * hint below it where the variant sets one. It reads the preview tokens, so
 * a dark frame draws it on the dark screen.
 */
export function MiniAction({ variant }: { variant: MiniActionVariant }) {
  const { hint, label, tone } = VARIANTS[variant];
  return (
    <div className="mbk-shot mbk-shot--action">
      <div className="mbk-shot-pad">
        <span className={`mbk-shot-action mbk-shot-action--${tone}`}>
          {label}
        </span>
        {hint === undefined ? null : <p>{hint}</p>}
      </div>
    </div>
  );
}
