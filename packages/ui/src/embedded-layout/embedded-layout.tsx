/**
 * The layout of an embedded viewer root: the shell's parts with the slots of
 * its host. The top host holds the top bar between two slots, the rail host
 * the navigation between two slots, and the stage host the main region with
 * the empty state and the stage overlay. The side panel follows the stage
 * host, and the marker and label layers lie over the root.
 */

import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  Ref,
} from "react";

import type { Appearance } from "../appearance-selector/appearance-selector.js";
import { LabelLayer } from "../highlight-label/highlight-label.js";
import {
  RouteStatus,
  ShellBody,
  SkipLink,
} from "../shell-layout/shell-layout.js";

import {
  HostSlot,
  StageOverlay,
  type StageOverlayContent,
} from "./host-slot.js";

/** The content that a host places in the slots of its root. */
export interface EmbeddedSlots {
  topBarStart?: ReactNode;
  topBarEnd?: ReactNode;
  railStart?: ReactNode;
  railEnd?: ReactNode;
  /** The panel after the stage, at the width that the host gives. */
  sidePanel?: { content: ReactNode; width: CSSProperties["width"] } | undefined;
  stageOverlay?: StageOverlayContent | undefined;
  /** The content in the place of the catalogue home. */
  emptyState?: ReactNode;
}

export function EmbeddedLayout({
  announcement,
  colorScheme,
  drawerOpen,
  emptyStateShown,
  labelLayer,
  main,
  mainHref,
  markerLayer,
  navigation,
  onClick,
  onKeyDown,
  ref,
  slots,
  statusId,
  theme,
  topBar,
}: {
  /** The route status's announcement of the last navigation. */
  announcement: string;
  /** The scheme of the shown previews, as `data-mokly-color-scheme`. */
  colorScheme: "dark" | "light";
  /** Whether the navigation drawer of a narrow root is open. */
  drawerOpen: boolean;
  /** Whether the empty state slot shows its content. */
  emptyStateShown: boolean;
  /** The label layer, such as a host inspection's. An empty one by default. */
  labelLayer?: ReactNode;
  /** The main region with the routed view. */
  main: ReactNode;
  /** The address of the main region, for the skip link. */
  mainHref: string;
  /** The layer of the host's markers. */
  markerLayer: ReactNode;
  navigation: ReactNode;
  onClick?: ((event: MouseEvent<HTMLDivElement>) => void) | undefined;
  onKeyDown?: ((event: KeyboardEvent<HTMLDivElement>) => void) | undefined;
  /** Receives the root. */
  ref?: Ref<HTMLDivElement> | undefined;
  slots?: EmbeddedSlots | undefined;
  statusId: string;
  /** The appearance that the root states, as `data-mokly-theme`. */
  theme: Appearance;
  topBar: ReactNode;
}) {
  return (
    <div
      className="mbk mokly-viewer"
      data-drawer={drawerOpen ? "open" : "closed"}
      data-mokly-color-scheme={colorScheme}
      data-mokly-shell=""
      onClick={onClick}
      onKeyDown={onKeyDown}
      ref={ref}
      tabIndex={-1}
      data-mokly-theme={theme}
    >
      <SkipLink href={mainHref} />
      <div className="mokly-top-host">
        <HostSlot name="topBarStart">{slots?.topBarStart}</HostSlot>
        {topBar}
        <HostSlot name="topBarEnd">{slots?.topBarEnd}</HostSlot>
      </div>
      <ShellBody>
        <div className="mokly-rail-host">
          <HostSlot name="railStart">{slots?.railStart}</HostSlot>
          {navigation}
          <HostSlot name="railEnd">{slots?.railEnd}</HostSlot>
        </div>
        <div className="mokly-stage-host">
          {main}
          <HostSlot hidden={!emptyStateShown} name="emptyState">
            {slots?.emptyState}
          </HostSlot>
          <StageOverlay value={slots?.stageOverlay} />
        </div>
        <HostSlot name="sidePanel" style={{ width: slots?.sidePanel?.width }}>
          {slots?.sidePanel?.content}
        </HostSlot>
      </ShellBody>
      {markerLayer}
      {labelLayer ?? <LabelLayer />}
      <RouteStatus id={statusId}>{announcement}</RouteStatus>
    </div>
  );
}

/** One host marker and its place over the root, in pixels. */
export interface MarkerRecord {
  id: string;
  rect: { left: number; top: number; width: number; height: number };
  /** The host's content of the marker. */
  content?: ReactNode;
}

/**
 * The layer of the host's markers, which is also the `markers` slot. Each
 * marker lies at its place and lets the pointer through.
 */
export function MarkerLayer({
  markers,
  ref,
}: {
  markers: readonly MarkerRecord[];
  /** Receives the layer, against which the host places the markers. */
  ref?: Ref<HTMLDivElement> | undefined;
}) {
  return (
    <div data-mokly-marker-layer="" data-mokly-slot="markers" ref={ref}>
      {markers.map((marker) => (
        <div
          data-mokly-marker={marker.id}
          key={marker.id}
          style={{
            position: "absolute",
            pointerEvents: "none",
            ...marker.rect,
          }}
        >
          {marker.content}
        </div>
      ))}
    </div>
  );
}
