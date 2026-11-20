import { Body } from "@firna/ui/typography";

import { componentInput, componentMetadata } from "./metadata";

/**
 * The desktop settings dialog frame: a section rail beside one active pane.
 * Firna's WebModalFrame renders nothing in static markup, so this registered
 * layout carries the dialog semantics for the catalogue only; the live app
 * uses the package modal. The pane's heading and close action arrive through
 * the `header` and `actions` slots, so the frame never owns a heading.
 */
export const settingsDialogInput = componentInput({
  ...componentMetadata(
    "Settings dialog",
    "Desktop settings frame: section rail, one active pane and its inline discard confirmation.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label"],
    properties: { label: { type: "string" } },
  },
  props: { label: "Settings" },
  slots: ["rail", "header", "children", "actions"],
  controls: { label: { kind: "text" } },
  render: ({ label, rail, header, children, actions }) => (
    <div
      className="fo-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="fo-dialog-rail">{rail}</div>
      <div className="fo-dialog-pane">
        <div className="fo-dialog-bar">
          <div className="fo-dialog-heading">{header}</div>
          {actions}
        </div>
        <div className="fo-dialog-body">{children}</div>
      </div>
    </div>
  ),
  variants: [
    {
      slug: "pane",
      title: "Pane",
      props: { label: "Settings" },
      slots: {
        rail: (
          <nav className="fo-dialog-sections" aria-label="Settings sections">
            <div className="fo-nav-group">
              <span className="fo-group-label">You</span>
              <div className="fo-nav">
                <span className="fo-nav-item" aria-current="page">
                  <span className="fo-nav-label">Account</span>
                </span>
              </div>
            </div>
            <div className="fo-nav-group">
              <span className="fo-group-label">Project</span>
              <div className="fo-nav">
                <span className="fo-nav-item">
                  <span className="fo-nav-label">Publishing tokens</span>
                </span>
              </div>
            </div>
          </nav>
        ),
        header: <span className="fo-dialog-title">Account</span>,
        children: (
          <section className="fo-stack">
            <Body color="muted">Cal · cal@example.com</Body>
          </section>
        ),
      },
    },
    {
      slug: "confirmation",
      title: "Discard confirmation",
      props: { label: "Settings" },
      slots: {
        rail: (
          <nav className="fo-dialog-sections" aria-label="Settings sections">
            <div className="fo-nav-group">
              <span className="fo-group-label">Project</span>
              <div className="fo-nav">
                <span className="fo-nav-item" aria-current="page">
                  <span className="fo-nav-label">Project</span>
                </span>
              </div>
            </div>
          </nav>
        ),
        header: <span className="fo-dialog-title">Project</span>,
        children: (
          <section className="fo-note">
            <span className="fo-note-title">Discard your changes?</span>
            <Body>Your unsaved changes in settings are lost.</Body>
          </section>
        ),
      },
    },
  ],
});
