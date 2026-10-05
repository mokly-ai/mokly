import type { ReactNode } from "react";

import { CopyIcon, ExpandIcon } from "../../parts/icons.js";
import { useDesignStyle } from "../style_context.js";

import type { DeviceFrameProps } from "./device-frame.js";

interface FrameLabelProps {
  lightOnly?: boolean | undefined;
  text?: string | undefined;
}

/** Uppercase caption above a device chrome, with its color-scheme state. */
function FrameLabel({ lightOnly, text }: FrameLabelProps) {
  if (text === undefined) {
    return null;
  }
  return (
    <p className="mbk-frame-label">
      {text}
      {lightOnly ? (
        <span className="mbk-frame-scheme-note">{" — Light only"}</span>
      ) : null}
    </p>
  );
}

interface PhoneFrameProps {
  children?: ReactNode;
  dark?: boolean | undefined;
  label?: string;
  lightOnly?: boolean;
  small?: boolean;
}

/** The clock, signal, Wi-Fi, and battery band reserved above a mobile screen. */
function PhoneStatusBar() {
  return (
    <div className="phone-status">
      <span>9:41</span>
      <span className="phone-status-icons" aria-hidden="true">
        <svg fill="currentColor" height={11} viewBox="0 0 18 12" width={16}>
          <rect height={4} rx={1} width={3} x={0} y={8} />
          <rect height={6.5} rx={1} width={3} x={5} y={5.5} />
          <rect height={9} rx={1} width={3} x={10} y={3} />
          <rect height={11.5} rx={1} width={3} x={15} y={0.5} />
        </svg>
        <svg fill="currentColor" height={11} viewBox="0 0 16 12" width={16}>
          <path d="M8 11.2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0-4.8c1.4 0 2.7.5 3.7 1.4l1.4-1.4A8 8 0 0 0 8 4.4a8 8 0 0 0-5.1 1.8l1.4 1.4A5.7 5.7 0 0 1 8 6.4ZM2.2 4.6 .8 3.2A11 11 0 0 1 8 .4a11 11 0 0 1 7.2 2.8l-1.4 1.4A9 9 0 0 0 8 2.4a9 9 0 0 0-5.8 2.2Z" />
        </svg>
        <svg height={11} viewBox="0 0 24 12" width={22}>
          <rect
            fill="none"
            height={10}
            rx={2.5}
            stroke="currentColor"
            width={20}
            x={1}
            y={1}
          />
          <rect
            fill="currentColor"
            height={4}
            rx={0.6}
            width={1.6}
            x={22}
            y={4}
          />
          <rect
            fill="currentColor"
            height={6.8}
            rx={1.4}
            width={14}
            x={2.8}
            y={2.6}
          />
        </svg>
      </span>
    </div>
  );
}

/** Realistic phone chrome around a mobile fragment depiction. */
function PhoneFrame({
  children,
  dark,
  label,
  lightOnly,
  small,
}: PhoneFrameProps) {
  return (
    <div className="mbk-frame-wrap mbk-frame-mobile">
      <FrameLabel lightOnly={lightOnly} text={label} />
      <div className={small ? "phone-frame phone-frame--sm" : "phone-frame"}>
        <div className="phone-notch" aria-hidden="true" />
        <div className={dark ? "phone-screen mbk-screen-dark" : "phone-screen"}>
          <PhoneStatusBar />
          {children}
          <div className="phone-home" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

interface BrowserFrameProps {
  address: string;
  children?: ReactNode;
  dark?: boolean | undefined;
  expandable?: boolean;
  label?: string;
  lightOnly?: boolean;
}

/** Browser chrome with traffic lights, address, and expand control. */
function BrowserFrame({
  address,
  children,
  dark,
  expandable = true,
  label,
  lightOnly,
}: BrowserFrameProps) {
  return (
    <div className="mbk-frame-wrap mbk-frame-desktop">
      <FrameLabel lightOnly={lightOnly} text={label} />
      <div className="browser-frame">
        <div className="browser-bar">
          <span className="lights" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="address">
            <span className="address-url">{address}</span>
            <span className="address-copy" aria-hidden="true">
              <CopyIcon />
            </span>
          </span>
          {expandable ? (
            <span className="browser-expand" aria-hidden="true">
              <ExpandIcon />
            </span>
          ) : null}
        </div>
        <div
          className={
            dark ? "browser-viewport mbk-screen-dark" : "browser-viewport"
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function DeviceFrameView(props: DeviceFrameProps) {
  useDesignStyle("device-frame");
  return props.device === "phone" ? (
    <PhoneFrame {...props} />
  ) : (
    <BrowserFrame {...props} />
  );
}
