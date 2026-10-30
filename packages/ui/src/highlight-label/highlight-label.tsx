/**
 * The labels of highlighted component instances over a preview: a layer that
 * lets the pointer through to the preview, and in it one button for each
 * instance, at the place that the host measured. A press selects the
 * instance.
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
 * One label: the instance's name at its place over the preview. A label names
 * the instance of the workspace that it selects, or the label of a host's
 * inspection.
 */
export function HighlightLabel({
  instanceKey,
  labelKey,
  left,
  onSelect,
  pointerEvents,
  text,
  top,
}: {
  /** The key of the workspace instance, as `data-instance-key`. */
  instanceKey?: string | undefined;
  /** The id of a host inspection's label, as `data-mokly-label-key`. */
  labelKey?: string | undefined;
  /** The distance from the layer's left edge, in pixels. */
  left: number;
  /** Receives each press. */
  onSelect: () => void;
  /**
   * `auto` also states the label's pointer events in its own style, as the
   * labels of a host's inspection do, so that no rule of the layer turns them
   * off.
   */
  pointerEvents?: "auto" | undefined;
  /** The instance's name, such as "Button · primary". */
  text: string;
  /** The distance from the layer's top edge, in pixels. */
  top: number;
}) {
  return (
    <button
      className="mbk-highlight-label mbk-reset"
      data-instance-key={instanceKey}
      data-mokly-label-key={labelKey}
      onClick={() => onSelect()}
      style={{ left, pointerEvents, top }}
      type="button"
    >
      {text}
    </button>
  );
}
