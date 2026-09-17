import type { WorkspaceData } from "../shell/workspace_data.js";

import type { ComponentControls } from "./component_controls.js";
import { element, renderProps } from "./inspector_panels.js";
import type { InspectorSelection } from "./inspector_panels.js";

export function renderWorkspaceProps(
  panel: HTMLElement,
  data: WorkspaceData,
  selection: InspectorSelection,
  controls: ComponentControls | undefined,
  onEdit: () => void,
): void {
  if (controls && !selection.instance) controls.mount(panel);
  else {
    renderProps(panel, data, selection);
    if (controls) {
      const edit = element(
        panel.ownerDocument,
        "button",
        "Edit component props",
      );
      edit.type = "button";
      edit.className = "mbk-chip";
      edit.addEventListener("click", () => {
        onEdit();
      });
      panel.append(edit);
    }
  }
}
