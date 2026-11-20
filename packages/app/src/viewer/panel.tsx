import { WebModalFrame } from "@firna/ui/modal";
import type { ReactNode } from "react";

import { Action } from "../components/action";
import {
  hiddenFrameHeader,
  overlayFrameBody,
  overlaySurface,
} from "../components/overlay-frame";
import { useCompact } from "../layout/viewport";

/**
 * One viewer slot's overlay: the shared modal's centered frame on a pointer
 * surface and a bottom sheet on a compact one, with the panel as the document's
 * subject. The frame supplies the portal, the focus trap, Escape, the backdrop
 * and the inert page beneath; the panel supplies the landmark and the heading,
 * because the frame owns neither.
 */
export function ViewerPanel({
  id,
  title,
  subtitle,
  onClose,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const compact = useCompact();
  return (
    <WebModalFrame
      title={title}
      onClose={onClose}
      showCloseButton={false}
      size="md"
      scroll={false}
      placement={compact ? "bottom-sheet" : "center"}
      surfaceStyle={overlaySurface(compact, 480)}
      bodyStyle={overlayFrameBody}
      headerStyle={hiddenFrameHeader}
      testID={"viewer-panel-" + id}
    >
      <main id="main" className="fo-viewer-panel-live">
        <div className="fo-viewer-panel-bar">
          <div className="fo-viewer-panel-heading">
            <h1 className="fo-viewer-panel-title">{title}</h1>
            {subtitle && (
              <span className="fo-viewer-panel-subtitle">{subtitle}</span>
            )}
          </div>
          <Action
            label="Close"
            tone="quiet"
            size="sm"
            onPress={onClose}
            testID={"close-" + id}
          />
        </div>
        <div className="fo-viewer-panel-body">{children}</div>
      </main>
    </WebModalFrame>
  );
}
