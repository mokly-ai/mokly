import { WebModalFrame } from "@firna/ui/modal";
import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";

import { Action } from "../components/action";
import {
  hiddenFrameHeader,
  overlayFrameBody,
  overlaySurface,
} from "../components/overlay-frame";
import { useCompact } from "../layout/viewport";

/**
 * The Canvas depth of a viewer panel over the stage: the 12px floating radius
 * on a pointer surface, where the bottom sheet keeps its own top corners, and
 * the deep shadow on both. The values are the shared Canvas depth sheet's
 * custom properties, so the panel takes the drawings' depth from the same
 * rules; the package modal takes them through its public surface style.
 */
function canvasDepth(compact: boolean): ViewStyle {
  return compact
    ? { boxShadow: "var(--fo-canvas-shadow-deep)" }
    : {
        borderRadius: "var(--fo-canvas-radius)",
        boxShadow: "var(--fo-canvas-shadow-deep)",
      };
}

/**
 * One viewer slot's overlay: the shared modal's centered frame on a pointer
 * surface and a bottom sheet on a compact one, with the panel as the document's
 * subject. The frame supplies the portal, the focus trap, Escape, the backdrop
 * and the inert page beneath; the panel supplies the landmark and the heading,
 * because the frame owns neither. The landmark carries `fo-canvas-panel`, which
 * the shared Canvas panel sheet draws the bar, the body and the rows under.
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
      surfaceStyle={[overlaySurface(compact, 480), canvasDepth(compact)]}
      bodyStyle={overlayFrameBody}
      headerStyle={hiddenFrameHeader}
      testID={"viewer-panel-" + id}
    >
      <main id="main" className="fo-viewer-panel-live fo-canvas-panel">
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
