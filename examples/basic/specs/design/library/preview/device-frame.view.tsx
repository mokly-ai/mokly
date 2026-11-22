import { mockLink } from "@mokly/mokly";

import {
  BrowserFrame,
  PhoneFrame,
} from "../../../../../../packages/ui/src/device-frame/device-frame.js";
import { PreviewFrame } from "../../../../../../packages/ui/src/preview-frame/preview-frame.js";

import type { DeviceFrameProps } from "./device-frame.js";

/**
 * The shipped frame of a preview: `PreviewFrame` around the phone or the
 * browser window, in the scheme of the depicted screen. It stands on a stage
 * and names its viewport above the chrome, as the shell's frames do. A
 * static artboard runs no script, so the window's bar is a picture of
 * itself. A light-only frame carries the shell's fallback mark,
 * whose note this component's stylesheet shows. The wrapper carries the
 * compact flag, which this component's stylesheet draws as the small phone.
 * A frame with a retry destination depicts a document that failed to load,
 * whose Try again links to that destination.
 */
export function DeviceFrameView({
  address,
  children,
  dark,
  device,
  expandable,
  lightOnly,
  retryDestination,
  small,
}: DeviceFrameProps) {
  return (
    <div
      className="mbk-device-frame"
      data-compact={small && device === "phone" ? "" : undefined}
    >
      <PreviewFrame
        error={retryDestination !== undefined}
        fallback={lightOnly}
        placement={{
          kind: "frame",
          viewport: device === "phone" ? "mobile" : "desktop",
        }}
        retry={
          retryDestination === undefined
            ? undefined
            : { href: mockLink(retryDestination) }
        }
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
