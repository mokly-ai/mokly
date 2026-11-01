import { mockLink } from "@mokly/mokly";

import { FlowStep } from "../../../../../../packages/ui/src/flow-step/flow-step.js";

import type { FlowStepProps } from "./flow-step.js";
import { FrameSettingScope } from "./frame_placement.js";

/**
 * The shipped step of a user flow: its number, title and description, the
 * link to the owning screen's artboard, and the frame of its slot as the
 * step's screen.
 */
export function FlowStepView({
  children,
  description,
  number,
  screenPath,
  screenTitle,
  title,
}: FlowStepProps) {
  return (
    <FlowStep
      description={description}
      number={number}
      screen={{ href: mockLink(screenPath), title: screenTitle }}
      title={title}
    >
      <FrameSettingScope setting="flow">{children}</FrameSettingScope>
    </FlowStep>
  );
}
