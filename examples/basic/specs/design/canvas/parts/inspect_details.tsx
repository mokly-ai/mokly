import { NoPropsPanel } from "../../components/controls/parts/limits.js";

import { CANVAS_ENTRIES } from "./entries.js";
import { ScreenInspect, type ScreenInspectState } from "./inspect_screen.js";
import {
  DETAILS_INSTANCES,
  type DetailsInstanceId,
} from "./instance_records.js";

/**
 * Inspect for Details, which the canonical branch added: a screen in both
 * schemes with no saved variant and no props, which renders the Action and
 * the Toolbar, so Highlight components is available. Its component tree
 * selects each of its instances, as Welcome's does.
 */
export function DetailsInspect(state: ScreenInspectState<DetailsInstanceId>) {
  return (
    <ScreenInspect
      {...state}
      entry={CANVAS_ENTRIES.details}
      instances={DETAILS_INSTANCES}
      props={{ body: <NoPropsPanel /> }}
      subject="details"
      variants={[{ label: "Details", current: true }]}
    />
  );
}
