import type { HTMLAttributes } from "react";

/** Event props that preserve a web viewer slot activation across its handoff. */
export type ViewerHandoffRootProps = Pick<
  HTMLAttributes<HTMLDivElement>,
  "onClick" | "onKeyDownCapture" | "onPointerDownCapture"
>;

/** The non-web viewer is a WebView boundary, so it has no DOM slot handoff. */
export function useViewerSlotHandoff(): {
  holdReady: boolean;
  rootProps: ViewerHandoffRootProps;
} {
  return { holdReady: false, rootProps: {} };
}
