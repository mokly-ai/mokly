// The browser chrome of a live preview. The store owns which frame is
// expanded and copies the address; `@mokly/ui/device-frame` draws the chrome,
// whose bar shows the "URL copied" message.

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { BrowserFrame as BrowserFrameView } from "@mokly/ui/device-frame";

import { useShellRoot } from "./root_context.js";
import { useShellStore } from "./store_context.js";

/** A desktop browser window whose viewport hosts the desktop fragment. */
export function BrowserFrame(props: {
  address: string;
  children?: ReactNode;
  expandable?: boolean;
  frameKey?: string;
}) {
  const elements = useShellRoot()?.elements;
  const store = useShellStore();
  const latestStore = useRef(store);
  latestStore.current = store;
  const { frameKey } = props;
  const expanded =
    frameKey !== undefined && store.state.expandedFrame === frameKey;
  // A frame that unmounts while expanded, such as a use-case step that a
  // narrow window replaces with a phone, leaves no page scrim behind.
  useEffect(() => {
    if (frameKey === undefined) return;
    return () => latestStore.current.releaseExpandedFrame(frameKey);
  }, [frameKey]);
  return (
    <BrowserFrameView
      address={props.address}
      expandable={props.expandable !== false}
      expanded={expanded}
      ref={expanded ? elements?.expandedBrowser : undefined}
      onCopy={() => store.copy(props.address)}
      onExpandedChange={(next) =>
        store.setExpandedFrame(next ? frameKey : undefined)
      }
    >
      {props.children}
    </BrowserFrameView>
  );
}
