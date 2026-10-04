import type { ReactNode } from "react";

import { optional, useDesignInstance } from "../library/composition.js";
import { deviceFrame } from "../library/preview/device-frame.js";

export function Stage({ children }: { children: ReactNode }) {
  return <div className="mbk-stage">{children}</div>;
}

/**
 * The bordered pane a whole document occupies on the dotted stage. A
 * light-only document keeps the light palette while the catalogue is Dark.
 */
export function DocumentPane({
  children,
  lightOnly,
}: {
  children: ReactNode;
  lightOnly?: boolean | undefined;
}) {
  return (
    <div
      className="mbk-doc-pane"
      data-mbk-light-only={lightOnly ? "" : undefined}
    >
      {children}
    </div>
  );
}

interface PhoneFrameProps {
  children: ReactNode;
  dark?: boolean | undefined;
  label?: string;
  lightOnly?: boolean;
  small?: boolean;
}

export function PhoneFrame({
  children,
  dark,
  label,
  lightOnly,
  small,
}: PhoneFrameProps) {
  return (
    <deviceFrame.Component
      moklyInstance={useDesignInstance("phone")}
      device="phone"
      dark={dark ?? false}
      lightOnly={lightOnly ?? false}
      small={small ?? false}
      expandable
      address=""
      {...optional("label", label)}
    >
      {children}
    </deviceFrame.Component>
  );
}

interface BrowserFrameProps {
  address: string;
  children: ReactNode;
  dark?: boolean | undefined;
  expandable?: boolean;
  label?: string;
  lightOnly?: boolean;
}

export function BrowserFrame({
  address,
  children,
  dark,
  expandable,
  label,
  lightOnly,
}: BrowserFrameProps) {
  return (
    <deviceFrame.Component
      moklyInstance={useDesignInstance("browser")}
      device="browser"
      address={address}
      dark={dark ?? false}
      lightOnly={lightOnly ?? false}
      small={false}
      expandable={expandable ?? true}
      {...optional("label", label)}
    >
      {children}
    </deviceFrame.Component>
  );
}
