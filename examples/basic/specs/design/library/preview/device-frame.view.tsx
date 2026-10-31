import {
  BrowserFrame,
  PhoneFrame,
} from "../../../../../../packages/ui/src/device-frame/device-frame.js";
import { PreviewFrame } from "../../../../../../packages/ui/src/preview-frame/preview-frame.js";

import type { DeviceFrameProps } from "./device-frame.js";
import { useFramePlacement } from "./frame_placement.js";

/**
 * The shipped frame of a preview: `PreviewFrame` around the phone or the
 * browser window, in the scheme of the depicted screen. On a stage it names
 * its viewport above the chrome, as the shell's frames do; in a flow step or
 * a comparison it stands where `FrameSettingScope` places it, without a
 * caption. A static artboard runs no script, so the window's bar is a
 * picture of itself. A light-only frame carries the shell's fallback mark,
 * whose note this component's stylesheet shows. The wrapper carries the
 * compact flag, which this component's stylesheet draws as the small phone.
 */
export function DeviceFrameView({
  address,
  children,
  dark,
  device,
  expandable,
  lightOnly,
  small,
}: DeviceFrameProps) {
  const placement = useFramePlacement(
    device === "phone" ? "mobile" : "desktop",
  );
  return (
    <div
      className="mbk-device-frame"
      data-compact={small && device === "phone" ? "" : undefined}
    >
      <PreviewFrame
        fallback={lightOnly}
        placement={placement}
        scheme={dark ? "dark" : "light"}
      >
        {device === "phone" ? (
          <PhoneFrame>{children}</PhoneFrame>
        ) : (
          <BrowserFrame
            address={address}
            expandable={expandable}
            interactive={false}
          >
            {children}
          </BrowserFrame>
        )}
      </PreviewFrame>
    </div>
  );
}
