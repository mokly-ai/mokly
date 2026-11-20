import { Body } from "@firna/ui/typography";

import { componentInput, componentMetadata } from "./metadata";

/**
 * The mobile settings layer: the same panes as the desktop dialog, presented
 * full screen with a bar that returns to the settings index or closes
 * settings. The pane supplies its own heading through the `header` slot, so
 * the frame owns none.
 */
export const settingsLayerInput = componentInput({
  ...componentMetadata(
    "Settings layer",
    "Mobile full-screen settings frame hosting one pane.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label"],
    properties: { label: { type: "string" } },
  },
  props: { label: "Settings" },
  slots: ["bar", "header", "children"],
  controls: { label: { kind: "text" } },
  render: ({ label, bar, header, children }) => (
    <section className="fo-layer" aria-label={label}>
      <div className="fo-layer-bar">{bar}</div>
      <div className="fo-layer-body">
        {header && <div className="fo-layer-heading">{header}</div>}
        {children}
      </div>
    </section>
  ),
  variants: [
    {
      slug: "pane",
      title: "Pane",
      props: { label: "Settings" },
      slots: {
        bar: <span className="fo-layer-back">Settings</span>,
        header: <span className="fo-dialog-title">Publishing tokens</span>,
        children: (
          <div className="fo-stack">
            <Body color="muted">GitHub Actions · mkc_2600…</Body>
          </div>
        ),
      },
    },
    {
      slug: "sections",
      title: "Sections",
      props: { label: "Settings" },
      slots: {
        bar: <span className="fo-layer-back">Close</span>,
        header: <span className="fo-dialog-title">Settings</span>,
        children: (
          <div className="fo-stack">
            <Body color="muted">Account · Workspace · Project</Body>
          </div>
        ),
      },
    },
  ],
});
