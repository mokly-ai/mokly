/**
 * The labels of highlighted component instances over a preview: a layer that
 * lets the pointer through to the preview, and in it one button for each
 * instance, at the place that the host measured. A press selects the
 * instance. A static depiction that runs no script draws a label as a link to
 * an address, or as a picture of itself.
 */

import type { CSSProperties, ReactNode, Ref } from "react";

/**
 * Where a label layer lies: over the whole viewport, as the workspace's labels
 * do, or over its viewer root, as the labels of a host's inspection do.
 */
export type LabelLayerPlacement = "root" | "viewport";

/** The inline place of each layer, in the order that the shell writes it. */
const PLACEMENT: Readonly<Record<LabelLayerPlacement, CSSProperties>> = {
  root: { position: "absolute", inset: 0, pointerEvents: "none" },
  viewport: {
    inset: 0,
    overflow: "hidden",
    pointerEvents: "none",
    position: "fixed",
    zIndex: 952,
  },
};

/**
 * The layer that holds the labels. A layer without a placement takes its
 * place from the stylesheet of its viewer root.
 */
export function LabelLayer({
  children,
  placement,
  ref,
}: {
  children?: ReactNode;
  placement?: LabelLayerPlacement | undefined;
  /** Receives the layer, against which the host measures the labels. */
  ref?: Ref<HTMLDivElement> | undefined;
}) {
  return (
    <div
      className="mbk-reset"
      data-mokly-label-layer=""
      ref={ref}
      style={placement === undefined ? undefined : PLACEMENT[placement]}
    >
      {children}
    </div>
  );
}

/**
 * A distance from an edge of the layer: pixels, or, in a static depiction
 * that cannot measure, a CSS length such as `calc(100% - 145px)`.
 */
export type LabelOffset = number | string;

/**
 * One label: the instance's name at its place over the preview. A label names
 * the instance of the workspace that it selects, or the label of a host's
 * inspection.
 */
export function HighlightLabel({
  current = false,
  href,
  instanceKey,
  interactive = true,
  labelKey,
  left,
  onSelect,
  pointerEvents,
  text,
  top,
}: {
  /**
   * Whether the label's address is the page that shows it, which marks the
   * link as the current page.
   */
  current?: boolean | undefined;
  /**
   * The address that a static depiction opens instead of selecting the
   * instance, such as another document that shows the instance selected. The
   * label is then a link.
   */
  href?: string | undefined;
  /** The key of the workspace instance, as `data-instance-key`. */
  instanceKey?: string | undefined;
  /**
   * Whether a label without an address is a button, as it is by default. A
   * static depiction that runs no script sets `false`, which draws such a
   * label as a picture of itself.
   */
  interactive?: boolean;
  /** The id of a host inspection's label, as `data-mokly-label-key`. */
  labelKey?: string | undefined;
  /** The distance from the layer's left edge. */
  left: LabelOffset;
  /** Receives each press of the button. */
  onSelect?: (() => void) | undefined;
  /**
   * `auto` also states the label's pointer events in its own style, as the
   * labels of a host's inspection do, so that no rule of the layer turns them
   * off.
   */
  pointerEvents?: "auto" | undefined;
  /** The instance's name, such as "Button · primary". */
  text: string;
  /** The distance from the layer's top edge. */
  top: LabelOffset;
}) {
  const style = { left, pointerEvents, top };
  if (href !== undefined)
    return (
      <a
        aria-current={current ? "page" : undefined}
        className="mbk-highlight-label mbk-reset"
        href={href}
        style={style}
      >
        {text}
      </a>
    );
  if (!interactive)
    return (
      <span className="mbk-highlight-label mbk-reset" style={style}>
        {text}
      </span>
    );
  return (
    <button
      className="mbk-highlight-label mbk-reset"
      data-instance-key={instanceKey}
      data-mokly-label-key={labelKey}
      onClick={() => onSelect?.()}
      style={style}
      type="button"
    >
      {text}
    </button>
  );
}
