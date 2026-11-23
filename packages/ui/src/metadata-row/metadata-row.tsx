/**
 * One labelled value of an entry's metadata, and the values that a row
 * shows: text, a code chip, a link, or a group of chips. The `metadata`
 * presentation draws a row of the details' metadata column, and the `props`
 * presentation draws a `dt` and `dd` pair inside a `dl`, such as one supplied
 * prop. The chips draw with the chip rules of the tag chip's stylesheet.
 */

import { Fragment, type ReactNode } from "react";

import {
  FlowIcon,
  ScreenIcon,
  VariantIcon,
  WorkspaceIcon,
} from "../icons/icons.js";
import type { DataAttribute } from "../segmented-control/segmented-control.js";

/** The empty data attribute that names an element, when there is one. */
function dataMark(mark: DataAttribute | undefined) {
  return mark === undefined ? {} : { [mark]: "" };
}

export function MetadataRow({
  children,
  hidden,
  label,
  mark,
  presentation = "metadata",
  valueMark,
}: {
  /** The value: text, a code chip, a link, or a group of chips. */
  children: ReactNode;
  /** Hides the row, such as a row that names nothing yet. */
  hidden?: boolean | undefined;
  label: string;
  /** An empty data attribute on the row, such as `data-workspace-changed-views`. */
  mark?: DataAttribute | undefined;
  /** A row of the metadata column, or a pair of a `dl`. */
  presentation?: "metadata" | "props" | undefined;
  /** An empty data attribute on the value. */
  valueMark?: DataAttribute | undefined;
}) {
  if (presentation === "props")
    return (
      <div {...dataMark(mark)} className="mbk-reset" hidden={hidden}>
        <dt className="mbk-reset">{label}</dt>
        <dd className="mbk-reset" {...dataMark(valueMark)}>
          {children}
        </dd>
      </div>
    );
  return (
    <div className="mbk-meta-row mbk-reset" {...dataMark(mark)} hidden={hidden}>
      <span className="mbk-meta-k mbk-reset">{label}</span>
      <span className="mbk-meta-v mbk-reset" {...dataMark(valueMark)}>
        {children}
      </span>
    </div>
  );
}

/** A path or a label in a code chip, such as an entry's source path. */
export function MetadataCode({ children }: { children: ReactNode }) {
  return <code className="mbk-code mbk-reset">{children}</code>;
}

/**
 * One segment of a path: a folder's breadcrumb, which links to the folder's
 * own page or reveals the folder in the catalogue, or plain text.
 */
export interface MetadataPathSegment {
  /** The folder's path, as `data-crumb-folder`, for a folder that a press reveals. */
  folder?: string | undefined;
  /** The address of the folder's own page, which makes the segment a link. */
  href?: string | undefined;
  /** Reveals the folder in the catalogue, which makes the segment a button. */
  onReveal?: (() => void) | undefined;
  /** The segment as written, such as `screens`. */
  text: string;
}

/** One segment's text, as a link, a button, or text. */
function PathSegment({ segment }: { segment: MetadataPathSegment }) {
  if (segment.href !== undefined)
    return (
      <a className="mbk-path-crumb mbk-reset" href={segment.href}>
        {segment.text}
      </a>
    );
  if (segment.onReveal !== undefined)
    return (
      <button
        className="mbk-path-crumb mbk-reset"
        data-crumb-folder={segment.folder}
        onClick={segment.onReveal}
        type="button"
      >
        {segment.text}
      </button>
    );
  return segment.text;
}

/**
 * A path in a code chip, as written, whose folder segments are breadcrumbs.
 * It may wrap after each `/`, never inside a segment.
 */
export function MetadataPath({
  segments,
}: {
  segments: readonly MetadataPathSegment[];
}) {
  return (
    <code className="mbk-code mbk-path mbk-reset">
      {segments.map((segment, index) => {
        const last = index === segments.length - 1;
        return (
          <Fragment key={index}>
            <span className="mbk-path-part mbk-reset">
              <PathSegment segment={segment} />
              {last ? null : "/"}
            </span>
            {last ? null : <wbr />}
          </Fragment>
        );
      })}
    </code>
  );
}

/** A link in a metadata value, such as a related document. */
export function MetadataLink({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  return (
    <a className="mbk-meta-link mbk-reset" href={href}>
      {children}
    </a>
  );
}

/** The group of chips, links, or code chips of one metadata value. */
export function MetadataChips({ children }: { children: ReactNode }) {
  return <span className="mbk-chips mbk-reset">{children}</span>;
}

/**
 * The kind of catalogue entry that an entry chip links to: a use case, a
 * variant, a component, or a screen. A use case draws as a flow chip, and
 * the others as screen chips.
 */
export type EntryChipKind = "use-case" | "variant" | "component" | "screen";

/**
 * The glyph of each entry kind, drawn when a chip renders. The module creates
 * no element while it loads: Playwright's test discovery on Node 22 fails when
 * the JSX runtime runs during an import.
 */
const GLYPHS: Record<EntryChipKind, () => ReactNode> = {
  "use-case": () => <FlowIcon size={11} />,
  variant: () => <VariantIcon size={11} />,
  component: () => <WorkspaceIcon name="components" size={11} />,
  screen: () => <ScreenIcon size={11} />,
};

/** A chip that links to a catalogue entry, with the glyph of its kind. */
export function EntryChip({
  href,
  kind,
  title,
}: {
  href: string;
  kind: EntryChipKind;
  /** The entry's title, which the chip shows. */
  title: string;
}) {
  return (
    <a
      className={`mbk-chip ${kind === "use-case" ? "flow" : "screen"} mbk-reset`}
      href={href}
    >
      {GLYPHS[kind]()}
      {title}
    </a>
  );
}
