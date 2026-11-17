import { WaitingDot } from "../components/placeholder-rows";
import { ControlPlaceholder, TextBar } from "../components/placeholders";
import { Slot } from "./chrome";

/**
 * The bar's controls whose labels the answer decides, while the route reads
 * the project, as the catalogue's waiting bar draws them: each a placeholder
 * in the control's own frame, hidden from assistive technology like every
 * placeholder. The controls whose labels are known draw themselves disabled,
 * through `BarAction`'s waiting form. The reference trigger waits the same
 * way while the entry resolves and nothing has named the reference.
 */

/** The width of the workspace and project trigger at the bar's size, in px. */
const projectTriggerWidth = 200;

/**
 * The width of the reference trigger, in px: its frame's 9rem, which every
 * longer name fills, the catalogue's branch name among them.
 */
const referenceTriggerWidth = 144;

/**
 * The width of the account trigger at the bar's size, in px: a reader named
 * by a short display name, as the catalogue draws the bar's reader.
 */
const accountTriggerWidth = 67;

/** The workspace and project trigger, whose label the project gives. */
export function ProjectTriggerWait() {
  return (
    <Slot name="projects" className="fo-top-project">
      <span className="fo-top-variable-control">
        <ControlPlaceholder size="sm" width={projectTriggerWidth} />
      </span>
    </Slot>
  );
}

/**
 * The reference trigger, while nothing has named the reference yet: a
 * placeholder in the reference's own frame.
 */
export function ReferenceTriggerWait() {
  return (
    <span className="fo-top-reference">
      <ControlPlaceholder size="sm" width={referenceTriggerWidth} />
    </span>
  );
}

/**
 * The publication slot. The reference and its state are the project's to
 * tell, so the trigger is a placeholder in the reference's own frame and the
 * state is a dot and a bar in its own line.
 */
export function PublicationSlotWait() {
  return (
    <Slot name="switcher">
      <ReferenceTriggerWait />
      <span className="fo-top-state" aria-hidden="true">
        <WaitingDot />
        <span className="fo-top-state-detail">
          <TextBar width="6em" />
        </span>
      </span>
    </Slot>
  );
}

/** The account trigger, while the session read says who the reader is. */
export function AccountTriggerWait() {
  return (
    <Slot name="account" className="fo-top-account">
      <span className="fo-top-variable-control">
        <ControlPlaceholder size="sm" width={accountTriggerWidth} />
      </span>
    </Slot>
  );
}
