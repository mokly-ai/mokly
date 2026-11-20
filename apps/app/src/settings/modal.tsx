import { WebModalFrame } from "@firna/ui/modal";
import { useRef } from "react";
import type { ReactNode } from "react";

import {
  hiddenFrameHeader,
  overlayFrameBody,
  overlaySurface,
} from "../components/overlay-frame";
import { useCompact } from "../layout/viewport";

import { useTopmostTab } from "./modal-focus";

/**
 * A question a pane asks over itself, a row's menu on a compact surface, or
 * the one render of a secret a write just returned. The package's modal frame
 * draws it as a centered card over the settings dialog on a pointer surface and
 * as a bottom sheet on a compact one; it supplies the portal, the focus trap,
 * Escape and the backdrop, marks the dialog beneath inert while it is open, and
 * returns focus to the control that opened it when it closes. The composition
 * inside is the registered panel's bar and body, so the bar carries the one
 * title and the frame's own header stays hidden.
 *
 * Tab stays inside it even when it is open over the settings dialog's own
 * frame; see `useTopmostTab`.
 *
 * `dismissible` is false while the modal's write is in flight, so neither
 * Escape nor the backdrop abandons a write already sent, and false for a
 * secret shown once, which only its own control closes.
 */
export function SettingsModal({
  title,
  description,
  onClose,
  dismissible = true,
  actions,
  testID,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  dismissible?: boolean;
  /** The bar's own control, where declining is not one of the decisions. */
  actions?: ReactNode;
  testID?: string;
  children: ReactNode;
}) {
  const compact = useCompact();
  const surface = useRef<HTMLDivElement>(null);
  useTopmostTab(surface);
  return (
    <WebModalFrame
      title={title}
      onClose={onClose}
      dismissible={dismissible}
      showCloseButton={false}
      size="md"
      scroll={false}
      placement={compact ? "bottom-sheet" : "center"}
      surfaceStyle={overlaySurface(compact, 440)}
      bodyStyle={overlayFrameBody}
      headerStyle={hiddenFrameHeader}
      testID={testID}
    >
      <div className="fo-viewer-panel-live" ref={surface}>
        <div className="fo-viewer-panel-bar">
          <div className="fo-viewer-panel-heading">
            <span className="fo-viewer-panel-title">{title}</span>
            {description && (
              <span className="fo-viewer-panel-subtitle">{description}</span>
            )}
          </div>
          {actions}
        </div>
        <div className="fo-viewer-panel-body">
          <div className="fo-panel-stack">{children}</div>
        </div>
      </div>
    </WebModalFrame>
  );
}
