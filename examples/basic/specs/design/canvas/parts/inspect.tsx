import { Fragment, type ReactNode } from "react";

import { MetadataCode } from "../../../../../../packages/ui/src/metadata-row/metadata-row.js";
import { CanvasGlyph } from "../../library/canvas/glyphs.js";
import { optional, useDesignInstance } from "../../library/composition.js";
import { changeStatusBadge } from "../../library/controls/change-status.js";
import {
  framesFilter,
  type FramesFilterProps,
} from "../../library/inspector/frames-filter.js";
import { MetaRow } from "../../parts/metadata_row.js";

import type { CanvasEntry } from "./entries.js";

/**
 * A path that may wrap after each slash, so a long path breaks between its
 * folders rather than inside a name.
 */
export function WrappingPath({ path }: { path: string }) {
  const parts = path.split("/");
  return (
    <>
      {parts.map((part, index) =>
        index < parts.length - 1 ? (
          <Fragment key={index}>
            <span className="cv-path-part">{part}/</span>
            <wbr />
          </Fragment>
        ) : (
          <span className="cv-path-part" key={index}>
            {part}
          </span>
        ),
      )}
    </>
  );
}

/** One section of Inspect: its head, with a count where one is known. */
export function InspectSection({
  children,
  count,
  title,
}: {
  children: ReactNode;
  count?: number | undefined;
  title: string;
}) {
  return (
    <section aria-label={title} className="cv-sec">
      <h3 className="cv-sec-head">
        {title}
        {count === undefined ? null : (
          <span className="cv-sec-count">{count}</span>
        )}
      </h3>
      {children}
    </section>
  );
}

/**
 * A folded section of Inspect: a native disclosure whose closed head names
 * the section and its count where one is known.
 */
export function InspectFold({
  children,
  count,
  name,
  title,
}: {
  children?: ReactNode;
  count?: number | undefined;
  name: string;
  title: string;
}) {
  return (
    <details className="cv-sec cv-fold" data-cv-section={name}>
      <summary className="cv-sec-head">
        <span className="cv-fold-title">
          {title}
          {count === undefined ? null : (
            <span className="cv-sec-count">{count}</span>
          )}
        </span>
        <CanvasGlyph name="chevron" size={14} />
      </summary>
      {children}
    </details>
  );
}

/**
 * The head of Inspect: the entry's title with its kind and its change
 * status, its description, its path and source, and the rest of its Details
 * rows.
 */
export function InspectHead({
  description,
  entry,
  rows,
  source,
}: {
  description: string;
  entry: CanvasEntry;
  /** The entry's other Details rows, such as Schemes and Tags. */
  rows?: ReactNode;
  source: string;
}) {
  const status = useDesignInstance("inspect-status");
  return (
    <section aria-label="Details" className="cv-sec cv-ins-head">
      <div className="cv-ins-title">
        <h2>{entry.title}</h2>
        {entry.kind === "component" ? (
          <span className="cv-kind-tag">
            <CanvasGlyph name="component" size={12} />
            Component
          </span>
        ) : null}
        {entry.status === undefined ? null : (
          <changeStatusBadge.Component
            moklyInstance={status}
            status={entry.status}
          />
        )}
      </div>
      <p className="cv-ins-desc">{description}</p>
      <div className="cv-ins-rows">
        <MetaRow name="path" label="Path">
          <MetadataCode>
            <WrappingPath path={entry.path} />
          </MetadataCode>
        </MetaRow>
        <MetaRow name="source" label="Source">
          <MetadataCode>
            <WrappingPath path={source} />
          </MetadataCode>
        </MetaRow>
        {rows}
      </div>
    </section>
  );
}

/** Why the entry exists, as a quiet section. */
export function InspectRationale({
  noun,
  text,
}: {
  noun: string;
  text: string;
}) {
  return (
    <section aria-label={`Why this ${noun}`} className="cv-sec cv-why">
      <h3 className="cv-sec-head">Why this {noun}</h3>
      <p>{text}</p>
    </section>
  );
}

/** A saved variant in Inspect's list: the shown one, or a picture. */
export interface InspectVariant {
  label: string;
  current?: boolean;
}

/**
 * The entry's saved variants as a radio list. A static artboard runs no
 * script, and no Canvas artboard shows another variant, so each row is a
 * picture of itself and the shown variant is checked.
 */
export function InspectVariants({
  variants,
}: {
  variants: readonly InspectVariant[];
}) {
  return (
    <InspectSection count={variants.length} title="Variants">
      <ul className="cv-variants">
        {variants.map((variant) => (
          <li
            aria-current={variant.current ? "true" : undefined}
            className="cv-variant"
            key={variant.label}
          >
            <span aria-hidden="true" className="cv-variant-mark" />
            {variant.label}
          </li>
        ))}
      </ul>
    </InspectSection>
  );
}

/** The Frames section: the shown frames' count, and the Frames filter. */
export function InspectFrames({
  count,
  filter,
}: {
  count: number;
  filter: FramesFilterProps;
}) {
  return (
    <InspectSection count={count} title="Frames">
      <framesFilter.Component
        moklyInstance={useDesignInstance("frames")}
        viewports={filter.viewports}
        mobile={filter.mobile}
        desktop={filter.desktop}
        light={filter.light}
        dark={filter.dark}
        highlight={filter.highlight}
        {...optional("lightOnly", filter.lightOnly)}
        {...optional("unavailable", filter.unavailable)}
      />
    </InspectSection>
  );
}

/** The Selection section while nothing on the canvas is selected. */
export function InspectSelection() {
  return (
    <InspectSection title="Selection">
      <p className="cv-hint">Click an element on a frame to see its props.</p>
    </InspectSection>
  );
}
