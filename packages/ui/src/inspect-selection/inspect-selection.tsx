/**
 * The Selection section of Inspect: what the reader selected on the canvas.
 * With nothing selected it says how to select. A selected instance's head
 * holds a chip with its component, which opens the component's page, and
 * the label of the frame where the reader selected it; the section lists the
 * props that the instance's owner supplies, each value as code, its size, its
 * box model, the slots that it fills, and its component's source file. A
 * selected frame's head holds a Frame chip with the frame's size, and its
 * rows name the variant and the scheme that the frame shows.
 */

import type { ReactNode, Ref } from "react";

import { CanvasIcon } from "../icons/canvas-icons.js";
import { InspectHint, InspectSection } from "../inspect-panel/inspect-panel.js";
import { MetadataRow } from "../metadata-row/metadata-row.js";
import { PropSlots } from "../props-panel/props-panel.js";

import { BoxModel, type BoxModelSizes } from "./box-model.js";

export { BoxModel, boxModelWords, type BoxModelSizes } from "./box-model.js";

/** A size in whole CSS pixels. */
export interface SelectionSize {
  width: number;
  height: number;
}

/** A selected component instance, as the Selection section shows it. */
export interface SelectedInstance {
  kind: "instance";
  /** The instance's component, and the address of the component's page. */
  component: { href?: string | undefined; title: string };
  /** The label of the frame where the reader selected the instance. */
  frame: string;
  /** The padding and the content size, when the frame measured them. */
  boxModel?: BoxModelSizes | undefined;
  /** The supplied props, each with its value as text. */
  props: readonly { name: string; value: string }[];
  /** The instance's size, when the frame measured it. */
  size?: SelectionSize | undefined;
  /** The slots that the instance fills, each with who supplies it. */
  slots?: readonly string[] | undefined;
  /** The component's source file. */
  source?: string | undefined;
}

/** A selected frame of a variant set. */
export interface SelectedFrame {
  kind: "frame";
  /** The name of the scheme that the frame shows, such as `Light`. */
  scheme: string;
  size: SelectionSize;
  /** The title of the variant that the frame shows. */
  variant: string;
}

/** What the canvas holds selected, if anything. */
export type InspectSelectionState =
  { kind: "none" } | SelectedFrame | SelectedInstance;

/** A size as the selection shows it, such as `112 × 30`. */
export function selectionSizeText({ height, width }: SelectionSize): string {
  return `${width} × ${height}`;
}

/** The chip at the head of the section: a link, or a picture of the chip. */
function Chip({
  children,
  href,
}: {
  children: ReactNode;
  href?: string | undefined;
}) {
  return href === undefined ? (
    <span className="mbk-inspect-chip mbk-reset">{children}</span>
  ) : (
    <a className="mbk-inspect-chip mbk-reset" href={href}>
      {children}
    </a>
  );
}

/** One row of the section's list: a name, and a value as code or as text. */
function Row({
  children,
  label,
  mark,
}: {
  children: ReactNode;
  label: string;
  mark?: `data-${string}` | undefined;
}) {
  return (
    <MetadataRow label={label} mark={mark} presentation="props">
      {children}
    </MetadataRow>
  );
}

function SelectedInstanceBody({ selection }: { selection: SelectedInstance }) {
  return (
    <>
      <dl className="mbk-inspect-props mbk-reset">
        {selection.props.map(({ name, value }) => (
          <Row key={name} label={name}>
            <code className="mbk-inspect-value mbk-reset">{value}</code>
          </Row>
        ))}
        {selection.size === undefined ? null : (
          <Row label="Size" mark="data-selection-size">
            <code className="mbk-inspect-value mbk-reset">
              {selectionSizeText(selection.size)}
            </code>
          </Row>
        )}
      </dl>
      {selection.boxModel === undefined ? null : (
        <BoxModel sizes={selection.boxModel} />
      )}
      <PropSlots slots={selection.slots} />
      {selection.source === undefined ? null : (
        <p className="mbk-inspect-source mbk-reset">
          <CanvasIcon name="document" size={13} />
          <span className="mbk-reset">{selection.source}</span>
        </p>
      )}
    </>
  );
}

export function InspectSelection({
  hint = "Click an element on a frame to see its props.",
  sectionRef,
  selection,
}: {
  /** The line while nothing is selected. */
  hint?: string | undefined;
  /** Receives the section, which the host scrolls into view. */
  sectionRef?: Ref<HTMLElement> | undefined;
  selection: InspectSelectionState;
}) {
  if (selection.kind === "none")
    return (
      <InspectSection
        label="Selection"
        name="selection"
        sectionRef={sectionRef}
      >
        <InspectHint>{hint}</InspectHint>
      </InspectSection>
    );
  if (selection.kind === "frame")
    return (
      <InspectSection
        count={selectionSizeText(selection.size)}
        heading={
          <Chip>
            <CanvasIcon name="frame" size={12} />
            Frame
          </Chip>
        }
        label="Selection"
        name="selection"
        sectionRef={sectionRef}
      >
        <dl className="mbk-inspect-props mbk-reset">
          <Row label="Variant">{selection.variant}</Row>
          <Row label="Scheme">{selection.scheme}</Row>
        </dl>
      </InspectSection>
    );
  return (
    <InspectSection
      count={selection.frame}
      heading={
        <Chip href={selection.component.href}>
          <CanvasIcon name="component" size={12} />
          {selection.component.title}
        </Chip>
      }
      label="Selection"
      name="selection"
      sectionRef={sectionRef}
    >
      <SelectedInstanceBody selection={selection} />
    </InspectSection>
  );
}
