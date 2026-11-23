import { WaitingDot } from "../components/placeholder-rows";
import { ControlPlaceholder, TextBar } from "../components/placeholders";

import { useCompactBar } from "./bar-width";
import { Slot } from "./chrome";
import { PillChevron, PillDot, PublicationPill } from "./pill";

/**
 * The bar's controls whose labels the answer decides, while the route reads
 * the project, as the catalogue's waiting bar draws them: each a placeholder
 * in the control's own frame, hidden from assistive technology like every
 * placeholder. The controls whose labels are known draw themselves disabled,
 * through `BarAction`'s waiting form. The publication pill waits the same way
 * while the entry resolves and nothing has named the reference: it holds no
 * control, only the reference's placeholder beside the state.
 */

/** The width of the workspace and project trigger at the bar's size, in px. */
const projectTriggerWidth = 200;

/**
 * The width of the reference's placeholder, in px: its frame's 9rem, which
 * every longer name fills, the catalogue's branch name among them.
 */
const referenceTriggerWidth = 144;

/**
 * The width of the account trigger at the bar's size, in px: the box of the
 * reader's avatar, as the catalogue draws it.
 */
const accountTriggerWidth = 34;

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
 * The publication pill's reference, while nothing has named the reference
 * yet: a placeholder in the reference's own frame, where the pill's control
 * draws the name once a read gives it.
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
 * tell, so the pill holds no control: the reference is a placeholder in its
 * own frame and the state is a dot and a bar in its own line, both hidden
 * from assistive technology like every placeholder. The pill keeps its
 * frame, its hairline and its chevron around them, and the compact pill its
 * dot.
 */
export function PublicationSlotWait() {
  const compact = useCompactBar();
  return (
    <Slot name="switcher">
      <PublicationPill waiting>
        {compact && <PillDot />}
        <ReferenceTriggerWait />
        <span className="fo-top-state" aria-hidden="true">
          <span className="fo-canvas-pill-rule" />
          <WaitingDot />
          <span className="fo-top-state-detail">
            <TextBar width="6em" />
          </span>
          <PillChevron />
        </span>
      </PublicationPill>
    </Slot>
  );
}

/** The account trigger, while the session read says who the reader is. */
export function AccountTriggerWait() {
  return (
    <Slot name="account" className="fo-top-fixed">
      <span className="fo-canvas-account">
        <ControlPlaceholder size="sm" width={accountTriggerWidth} />
      </span>
    </Slot>
  );
}
