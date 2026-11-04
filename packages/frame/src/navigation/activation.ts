/** Event rules shared by both frame transports. No React. */

export interface LinkActivation {
  readonly altKey: boolean;
  readonly button: number;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

/** The activation a marked frame link reports, or an activation it leaves native. */
export function frameLinkActivation(
  event: LinkActivation & { readonly type: string },
  download: boolean,
): "middle" | "modified" | "primary" | undefined {
  if (download || event.altKey) return;
  if (event.type === "click" ? event.button !== 0 : event.button !== 1) return;
  return event.type === "auxclick"
    ? "middle"
    : event.metaKey || event.ctrlKey || event.shiftKey
      ? "modified"
      : "primary";
}
