import type { ReactNode } from "react";

import { Panel } from "../../../entries/design/panel.mockup";

/**
 * A question a pane asks over itself, or the one render of a secret it just
 * made. The registered panel is a centered modal on a pointer viewport and a
 * bottom sheet on a touch one, so the content never knows which hosts it. The
 * pane beneath keeps its place, and the modal opens no layer of its own.
 */
export function SettingsModal({
  title,
  description,
  instance,
  actions,
  children,
}: {
  title: string;
  description?: string;
  instance: string;
  /** The bar's own control, where declining is not one of the decisions. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel
      moklyInstance={instance}
      label={title}
      header={
        <>
          <span className="fo-viewer-panel-title">{title}</span>
          {description && (
            <span className="fo-viewer-panel-subtitle">{description}</span>
          )}
        </>
      }
      actions={actions}
    >
      <div className="fo-panel-stack">{children}</div>
    </Panel>
  );
}
