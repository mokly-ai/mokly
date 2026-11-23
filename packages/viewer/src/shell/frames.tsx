// The browser chrome of a comparison's desktop pane. The store copies the
// address; `@mokly/ui/device-frame` draws the chrome, whose bar shows the "URL
// copied" message. The window does not expand.

import type { ReactNode } from "react";

import { BrowserFrame as BrowserFrameView } from "@mokly/ui/device-frame";

import { useShellStore } from "./store_context.js";

/** A desktop browser window whose viewport hosts the desktop fragment. */
export function BrowserFrame(props: { address: string; children?: ReactNode }) {
  const store = useShellStore();
  return (
    <BrowserFrameView
      address={props.address}
      expandable={false}
      onCopy={() => store.copy(props.address)}
    >
      {props.children}
    </BrowserFrameView>
  );
}
