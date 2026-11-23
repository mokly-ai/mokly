/**
 * The body of the right panel's Changes tab. It lays out its parts in a
 * fixed order: the change stepper, a full-width row under the tabs; the
 * host's slot; Compared, a section with that heading; the compare modes, a
 * section headed Compare; and the comparison details, whose evidence brings
 * its own heading. An absent part draws nothing, and an empty slot takes no
 * space.
 */

import type { ReactNode, Ref } from "react";

/** Whether a part draws something: React renders nothing for the others. */
function present(part: ReactNode): boolean {
  return (
    part !== undefined &&
    part !== null &&
    typeof part !== "boolean" &&
    part !== ""
  );
}

/** A part of the panel under its heading. */
function PanelSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section aria-label={title} className="mbk-changes-section mbk-reset">
      <h3 className="mbk-changes-head mbk-reset">{title}</h3>
      {children}
    </section>
  );
}

/**
 * The host slot's container carries no reset class, because its content
 * stays the host's. The panel draws no container for an absent slot, and
 * its stylesheet hides a container that the host's own component leaves
 * empty.
 */
export function ChangesPanel({
  compared,
  details,
  modes,
  slot,
  slotRef,
  stepper,
}: {
  /** The change stepper; absent for an entry that the Changes filter does not list. */
  stepper?: ReactNode;
  /** The host's content after the stepper. An empty slot takes no space. */
  slot?: ReactNode;
  /** Receives the slot's container, so the shell can tell host content apart. */
  slotRef?: Ref<HTMLDivElement> | undefined;
  /** The Compared rail. */
  compared?: ReactNode;
  /** The compare modes; absent for a use case or a page. */
  modes?: ReactNode;
  /** The comparison details. */
  details?: ReactNode;
}) {
  return (
    <div className="mbk-changes mbk-reset">
      {present(stepper) ? stepper : null}
      {present(slot) ? (
        <div data-mokly-slot="changesStart" ref={slotRef}>
          {slot}
        </div>
      ) : null}
      {present(compared) ? (
        <PanelSection title="Compared">{compared}</PanelSection>
      ) : null}
      {present(modes) ? (
        <PanelSection title="Compare">{modes}</PanelSection>
      ) : null}
      {present(details) ? (
        <div className="mbk-changes-section mbk-changes-details mbk-reset">
          {details}
        </div>
      ) : null}
    </div>
  );
}
