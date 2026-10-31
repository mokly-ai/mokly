import { createContext, useContext, type ReactNode } from "react";

import type {
  FramePlacement,
  FrameViewport,
} from "../../../../../../packages/ui/src/preview-frame/preview-frame.js";

/**
 * Where a depicted frame stands when it is not on a stage: the screen of a
 * flow step, or the chrome of a comparison. The shell draws neither with a
 * caption.
 */
export type FrameSetting = "flow" | "pane";

const Setting = createContext<FrameSetting | undefined>(undefined);

/**
 * The documented shared context of the preview group: a flow step and a
 * comparison tell the device frame in their slot where it stands, as the
 * shell's flow and comparison containers place their frames.
 */
export function FrameSettingScope({
  children,
  setting,
}: {
  children?: ReactNode;
  setting: FrameSetting;
}) {
  return <Setting value={setting}>{children}</Setting>;
}

/**
 * The shipped placement of a frame of one viewport: a frame on a stage by
 * default, which names its viewport above the chrome.
 */
export function useFramePlacement(viewport: FrameViewport): FramePlacement {
  const setting = useContext(Setting);
  return setting === undefined
    ? { kind: "frame", viewport }
    : { kind: setting };
}
