import { ScreenControls } from "../../components/controls/parts/screen_controls.js";

import { CANVAS_ENTRIES } from "./entries.js";
import { ScreenInspect, type ScreenInspectState } from "./inspect_screen.js";
import {
  WELCOME_INSTANCES,
  type WelcomeInstanceId,
} from "./instance_records.js";

/**
 * Inspect for Welcome: changed on the canonical branch, in both schemes. The
 * Selection section shows the selected instance, and the folded sections
 * hold Welcome's props controls, its usage, and its component tree.
 */
export function WelcomeInspect(state: ScreenInspectState<WelcomeInstanceId>) {
  return (
    <ScreenInspect
      {...state}
      entry={CANVAS_ENTRIES.welcome}
      instances={WELCOME_INSTANCES}
      props={{ count: 1, body: <ScreenControls /> }}
      subject="welcome"
      variants={[
        { label: "Welcome", current: true },
        { label: "Empty workspace" },
        { label: "Save failed" },
      ]}
    />
  );
}
