/**
 * The head of Inspect and the section of an entry's rationale. The head
 * names the entry: its title, the `Component` kind tag of a component, and
 * its change status, then its description and its Details rows, which the
 * host draws with `@mokly/ui/metadata-row`.
 */

import type { ReactNode } from "react";

import { CanvasIcon } from "../icons/canvas-icons.js";

export function InspectHead({
  children,
  component = false,
  description,
  title,
  status,
}: {
  /** The Details rows, such as the path and the source. */
  children?: ReactNode;
  /** Whether the entry is a component, which adds the kind tag. */
  component?: boolean | undefined;
  /** The entry's description; an empty one draws no line. */
  description?: string | undefined;
  /** The entry's change status, such as a `ChangeStatus`. */
  status?: ReactNode;
  title: string;
}) {
  return (
    <section
      aria-label="Details"
      className="mbk-inspect-section mbk-inspect-head mbk-reset"
      data-inspect-section="details"
    >
      <div className="mbk-inspect-title mbk-reset">
        <h2 className="mbk-reset">{title}</h2>
        {component ? (
          <span className="mbk-inspect-kind mbk-reset">
            <CanvasIcon name="component" size={12} />
            Component
          </span>
        ) : null}
        {status}
      </div>
      {description ? (
        <p className="mbk-inspect-description mbk-reset">{description}</p>
      ) : null}
      <div className="mbk-inspect-rows mbk-reset">{children}</div>
    </section>
  );
}

/**
 * Why the entry exists, in a quiet section named for the entry's kind, such
 * as `Why this screen`.
 */
export function InspectRationale({
  noun,
  text,
}: {
  /** The entry's kind in lower case, such as `screen`. */
  noun: string;
  text: string;
}) {
  const label = `Why this ${noun}`;
  return (
    <section
      aria-label={label}
      className="mbk-inspect-section mbk-reset"
      data-inspect-section="rationale"
    >
      <h3 className="mbk-inspect-section-head mbk-reset">{label}</h3>
      <p className="mbk-inspect-rationale mbk-reset">{text}</p>
    </section>
  );
}

/** One variant of Inspect's list: the entry itself or one of its variants. */
export interface InspectVariant {
  /** Whether the variant is the shown or the chosen one, which the list checks. */
  current: boolean;
  /**
   * The address that opens the variant, which makes the row a link. Without
   * it and without `onChoose`, the row is a picture.
   */
  href?: string | undefined;
  /** Names the row among its siblings. */
  key: string;
  label: string;
  /**
   * Receives a choice of the variant, which makes the row a button that is
   * pressed while the variant is chosen, such as a variant set's row, whose
   * choice selects a frame rather than opening a page.
   */
  onChoose?: (() => void) | undefined;
  /** The variant's path, as `data-inspect-variant`. */
  path?: string | undefined;
}

/** A variant's radio mark and its name. */
function VariantContent({ label }: { label: string }) {
  return (
    <>
      <span aria-hidden="true" className="mbk-inspect-variant-mark mbk-reset" />
      {label}
    </>
  );
}

/** One row of the list: a link, a button, or a picture of the row. */
function VariantRow({ variant }: { variant: InspectVariant }) {
  const content = <VariantContent label={variant.label} />;
  if (variant.onChoose !== undefined)
    return (
      <button
        aria-pressed={variant.current}
        className="mbk-inspect-variant mbk-reset"
        data-checked={variant.current ? "" : undefined}
        data-inspect-variant={variant.path}
        onClick={variant.onChoose}
        type="button"
      >
        {content}
      </button>
    );
  if (variant.href !== undefined)
    return (
      <a
        aria-current={variant.current ? "page" : undefined}
        className="mbk-inspect-variant mbk-reset"
        data-checked={variant.current ? "" : undefined}
        data-inspect-variant={variant.path}
        href={variant.href}
      >
        {content}
      </a>
    );
  return (
    <span
      aria-current={variant.current ? "true" : undefined}
      className="mbk-inspect-variant mbk-reset"
      data-checked={variant.current ? "" : undefined}
      data-inspect-variant={variant.path}
    >
      {content}
    </span>
  );
}

/**
 * The Variants section: a radio list that names the entry itself first and
 * then its saved variants, with their count. A variant that opens a page is
 * a link, marked as the current page while it shows; a variant whose choice
 * the host handles, such as a variant set's, is a button, pressed while it
 * is chosen.
 */
export function InspectVariants({
  variants,
}: {
  variants: readonly InspectVariant[];
}) {
  return (
    <section
      aria-label="Variants"
      className="mbk-inspect-section mbk-reset"
      data-inspect-section="variants"
    >
      <h3 className="mbk-inspect-section-head mbk-reset">
        Variants{" "}
        <span className="mbk-inspect-count mbk-reset">{variants.length}</span>
      </h3>
      <ul className="mbk-inspect-variants mbk-reset">
        {variants.map((variant) => (
          <li className="mbk-reset" key={variant.key}>
            <VariantRow variant={variant} />
          </li>
        ))}
      </ul>
    </section>
  );
}
