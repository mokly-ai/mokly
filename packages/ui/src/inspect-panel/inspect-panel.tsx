/**
 * The Inspect tab of the right panel: its body, its sections, and its folded
 * sections. A section has a head that names it, with its count where one is
 * known. A folded section is a native disclosure whose summary names the
 * section and its count, so it opens and closes without a script; it keeps
 * its open state while it stays mounted. The host scrolls a section into
 * view through the element that `sectionRef` receives.
 */

import { useState, type ReactNode, type Ref } from "react";

import { CanvasIcon } from "../icons/canvas-icons.js";

/** The body of Inspect, which sets its sections in Inspect's type. */
export function InspectPanel({ children }: { children?: ReactNode }) {
  return <div className="mbk-inspect mbk-reset">{children}</div>;
}

/** A section's title with its count, where one is known. */
function SectionTitle({
  count,
  title,
}: {
  count?: number | string | undefined;
  title: ReactNode;
}) {
  return (
    <>
      {title}
      {count === undefined ? null : (
        <>
          {" "}
          <span className="mbk-inspect-count mbk-reset">{count}</span>
        </>
      )}
    </>
  );
}

/**
 * One section of Inspect. Its head names it, or holds `heading` in its
 * place, such as the Selection section's chip; `label` then names the
 * section for assistive technology.
 */
export function InspectSection({
  children,
  count,
  heading,
  label,
  name,
  sectionRef,
}: {
  children?: ReactNode;
  /** The count beside the title, such as the number of shown frames. */
  count?: number | string | undefined;
  /** What the head holds in place of the label, such as a chip. */
  heading?: ReactNode;
  /** The section's name, which its head shows without `heading`. */
  label: string;
  /** The section's mark, as `data-inspect-section`. */
  name?: string | undefined;
  /** Receives the section, which the host scrolls into view. */
  sectionRef?: Ref<HTMLElement> | undefined;
}) {
  return (
    <section
      aria-label={label}
      className="mbk-inspect-section mbk-reset"
      data-inspect-section={name}
      ref={sectionRef}
    >
      <h3 className="mbk-inspect-section-head mbk-reset">
        <SectionTitle count={count} title={heading ?? label} />
      </h3>
      {children}
    </section>
  );
}

/**
 * A folded section of Inspect: a native disclosure whose summary names the
 * section and its count where one is known, such as Props, Usage and
 * Components. It starts closed unless `initiallyOpen` says otherwise.
 */
export function InspectFold({
  children,
  count,
  initiallyOpen = false,
  name,
  title,
}: {
  children?: ReactNode;
  count?: number | string | undefined;
  /** Whether the section starts unfolded. */
  initiallyOpen?: boolean | undefined;
  /** The section's mark, as `data-inspect-section`. */
  name: string;
  title: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <details
      className="mbk-inspect-section mbk-inspect-fold mbk-reset"
      data-inspect-section={name}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
    >
      <summary className="mbk-inspect-section-head mbk-reset">
        <span className="mbk-inspect-fold-title mbk-reset">
          <SectionTitle count={count} title={title} />
        </span>
        <CanvasIcon name="chevron" size={14} />
      </summary>
      <div className="mbk-inspect-fold-body mbk-reset">{children}</div>
    </details>
  );
}

/** A quiet line of Inspect, such as the Selection section's hint. */
export function InspectHint({ children }: { children: ReactNode }) {
  return <p className="mbk-inspect-hint mbk-reset">{children}</p>;
}
