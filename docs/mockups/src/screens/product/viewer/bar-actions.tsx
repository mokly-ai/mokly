import { Action } from "../page-parts";

/**
 * The bar's actions that the fallback bar and the published slots share. Each
 * is the registered Button through `Action`, compact and on one line, with
 * the same instance key in both bars, so it stays the button that the
 * application draws. Each takes the catalogue entry it opens, which a
 * published slot leaves out, and `disabled` while the route reads the project.
 */
interface BarActionProps {
  /** The catalogue entry the action opens. A published slot opens none. */
  to?: string;
  disabled?: boolean;
}

/**
 * History: the quiet Button, with History's clock as its icon. A bar without
 * room for its label draws the clock alone, named and titled by the label.
 * A drawing draws both forms for the label rule in `viewer-bar.css` to show
 * one, so each form keeps its own instance key.
 */
export function HistoryTrigger({
  to,
  disabled = false,
  iconOnly = false,
}: BarActionProps & { iconOnly?: boolean }) {
  return (
    <Action
      instance={iconOnly ? "viewer-history-glyph" : "viewer-history"}
      label="History"
      icon="history"
      tone="quiet"
      size="sm"
      singleLine
      to={to}
      disabled={disabled}
      {...(iconOnly ? { iconOnly } : {})}
    />
  );
}

/**
 * Share: the signal fill where it is the screen's one primary action, and the
 * secondary tone where a panel, a sheet or a stage card owns that action.
 */
export function ShareTrigger({
  tone,
  to,
  disabled = false,
}: BarActionProps & { tone: "primary" | "secondary" }) {
  return (
    <Action
      instance="viewer-share"
      label="Share"
      tone={tone}
      size="sm"
      singleLine
      to={to}
      disabled={disabled}
    />
  );
}

/** More, the compact bar's one menu: the quiet Button with its chevron. */
export function MoreTrigger({ to, disabled = false }: BarActionProps) {
  return (
    <Action
      instance="viewer-more"
      label="More"
      tone="quiet"
      size="sm"
      chevron
      singleLine
      to={to}
      disabled={disabled}
    />
  );
}
