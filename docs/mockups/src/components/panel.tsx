import { Body } from "@firna/ui/typography";

import { componentInput, componentMetadata } from "./metadata";

/**
 * The viewer's overlay frame: a centered modal on a pointer viewport and a
 * bottom sheet on a touch one, chosen from the rendering context so a panel
 * never knows which presentation hosts it. Firna's WebModalFrame renders
 * nothing in static markup, so this registered layout carries the dialog
 * semantics for the catalogue only; the live app uses the package modal. The
 * screen supplies the `main` landmark and the heading through the `header`
 * slot, so the frame owns neither.
 */
export const panelInput = componentInput({
  ...componentMetadata(
    "Panel",
    "The viewer's overlay: a centered modal on desktop and a bottom sheet on mobile.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label"],
    properties: { label: { type: "string" } },
  },
  props: { label: "Branches and pull requests" },
  slots: ["header", "children", "actions"],
  controls: { label: { kind: "text" } },
  render: ({ label, header, children, actions }, { viewport }) => (
    <section
      className={
        "fo-viewer-panel " +
        (viewport === "mobile" ? "fo-viewer-sheet" : "fo-viewer-modal")
      }
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="fo-viewer-panel-bar">
        <div className="fo-viewer-panel-heading">
          {header ?? <span className="fo-viewer-panel-title">{label}</span>}
        </div>
        {actions}
      </div>
      <div className="fo-viewer-panel-body">{children}</div>
    </section>
  ),
  variants: [
    {
      slug: "publications",
      title: "Publications",
      props: { label: "Branches and pull requests" },
      slots: {
        header: (
          <span className="fo-viewer-panel-title">
            Branches and pull requests
          </span>
        ),
        children: (
          <div className="fo-stack">
            <Body color="muted">main · Published 15 Sep · 3e81b6c</Body>
          </div>
        ),
      },
    },
    {
      slug: "share",
      title: "Share",
      props: { label: "Share" },
      slots: {
        header: <span className="fo-viewer-panel-title">Share</span>,
        children: (
          <div className="fo-stack">
            <Body color="muted">Project members can open this link.</Body>
          </div>
        ),
      },
    },
  ],
});
