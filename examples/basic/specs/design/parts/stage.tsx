import type { ReactNode } from "react";

import { DocumentFrame } from "../../../../../packages/ui/src/preview-frame/preview-frame.js";
import { Stage as StageView } from "../../../../../packages/ui/src/stage/stage.js";
import { useDesignInstance } from "../library/composition.js";
import { deviceFrame } from "../library/preview/device-frame.js";

/** The shipped dotted stage around the previews of a workspace or a state. */
export function Stage({ children }: { children: ReactNode }) {
  return <StageView>{children}</StageView>;
}

/**
 * A whole document on the shipped document stage, in the bordered pane that
 * depicts its frame. A light-only document keeps the light palette while the
 * catalogue is Dark.
 */
export function DocumentStage({
  children,
  lightOnly,
}: {
  children: ReactNode;
  lightOnly?: boolean | undefined;
}) {
  return (
    <DocumentFrame scheme="light">
      <div
        className="mbk-doc-pane"
        data-mbk-light-only={lightOnly ? "" : undefined}
      >
        {children}
      </div>
    </DocumentFrame>
  );
}

interface PhoneFrameProps {
  children: ReactNode;
  dark?: boolean | undefined;
  lightOnly?: boolean;
  small?: boolean;
}

export function PhoneFrame({
  children,
  dark,
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
  lightOnly?: boolean;
}

export function BrowserFrame({
  address,
  children,
  dark,
  expandable,
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
    >
      {children}
    </deviceFrame.Component>
  );
}
