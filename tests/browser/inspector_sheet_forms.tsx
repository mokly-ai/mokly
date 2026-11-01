/**
 * A browser entry of `inspector_sheet.spec.ts`: the shell's open inspector in
 * a positioned workspace, which places the inspector's sheet below the
 * layout breakpoint.
 */

import { renderToStaticMarkup } from "react-dom/server";

import { Inspector } from "@mokly/ui/inspector";

document.body.innerHTML = renderToStaticMarkup(
  <div data-workspace="" style={{ height: "600px", position: "relative" }}>
    <Inspector
      active="details"
      contentId="inspector-content"
      interactive
      open
      tabs={[
        {
          id: "details",
          panel: <p>A clear next step.</p>,
          panelId: "inspector-details",
          tabId: "inspector-details-tab",
          title: "Details",
        },
      ]}
    />
  </div>,
);
document.body.dataset["rendered"] = "";
