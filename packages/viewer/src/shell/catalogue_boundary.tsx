/**
 * The catcher around a viewer root's ready shell. A document of the supported
 * version that the shell cannot render becomes the root's failure state. A
 * value that host code throws inside the shell passes the catcher unchanged,
 * so a host keeps its own error handling for its callbacks and its content.
 */

import { Component, useMemo } from "react";
import type { ReactNode, Ref } from "react";

import type {
  MoklyViewerHandle,
  MoklyViewerProps,
  ViewerEvents,
  ViewerMarker,
  ViewerSlots,
} from "../host/types.js";

import { HostCleanupMark } from "./host_cleanup.js";

/** The values that the host code of one viewer threw inside its shell. */
export interface HostErrors {
  mark(error: unknown): void;
  threw(error: unknown): boolean;
}

/** A record for one viewer. A weak set cannot hold a primitive value. */
export function hostErrors(): HostErrors {
  const objects = new WeakSet<object>();
  const primitives = new Set<unknown>();
  const isObject = (value: unknown): value is object =>
    (typeof value === "object" && value !== null) ||
    typeof value === "function";
  return {
    mark(error) {
      if (isObject(error)) objects.add(error);
      else primitives.add(error);
    },
    threw: (error) =>
      isObject(error) ? objects.has(error) : primitives.has(error),
  };
}

interface CaughtState {
  caught?: { error: unknown } | undefined;
}

/**
 * Render the shell below, and call `onFailure` instead when it throws while it
 * renders or runs its effects. The root then shows its failure state. A value
 * that `hostThrew` names goes on to the host's error handling unchanged.
 * `markCleanup` records what the cleanup of a host's frame adapter throws.
 */
export class CatalogueBoundary extends Component<
  {
    children: ReactNode;
    hostThrew?: ((error: unknown) => boolean) | undefined;
    markCleanup?: ((error: unknown) => void) | undefined;
    onFailure(): void;
  },
  CaughtState
> {
  override state: CaughtState = {};

  static getDerivedStateFromError(error: unknown): CaughtState {
    return { caught: { error } };
  }

  // React calls this only for a failure that the render below keeps.
  override componentDidCatch(): void {
    this.props.onFailure();
  }

  override render(): ReactNode {
    const { caught } = this.state;
    if (caught && this.props.hostThrew?.(caught.error)) throw caught.error;
    if (caught) return null;
    return (
      <HostCleanupMark.Provider value={this.props.markCleanup}>
        {this.props.children}
      </HostCleanupMark.Provider>
    );
  }
}

/** Host content, such as a slot or a marker. A value it throws stays the host's. */
class HostContent extends Component<
  { children: ReactNode; mark(error: unknown): void },
  CaughtState
> {
  override state: CaughtState = {};

  static getDerivedStateFromError(error: unknown): CaughtState {
    return { caught: { error } };
  }

  override render(): ReactNode {
    const { caught } = this.state;
    if (!caught) return this.props.children;
    this.props.mark(caught.error);
    throw caught.error;
  }
}

/** Call host code. A value that it throws stays the host's. */
function hostCall<A extends unknown[], R>(
  callback: (...args: A) => R,
  errors: HostErrors,
): (...args: A) => R {
  return (...args) => {
    try {
      return callback(...args);
    } catch (error) {
      errors.mark(error);
      throw error;
    }
  };
}

function hostEvents(events: ViewerEvents, errors: HostErrors): ViewerEvents {
  const guarded: ViewerEvents = {};
  if (events.onError) guarded.onError = hostCall(events.onError, errors);
  if (events.onInstanceClick)
    guarded.onInstanceClick = hostCall(events.onInstanceClick, errors);
  if (events.onInstanceHover)
    guarded.onInstanceHover = hostCall(events.onInstanceHover, errors);
  if (events.onMarkerChange)
    guarded.onMarkerChange = hostCall(events.onMarkerChange, errors);
  if (events.onPickEnd) guarded.onPickEnd = hostCall(events.onPickEnd, errors);
  if (events.onPickStart)
    guarded.onPickStart = hostCall(events.onPickStart, errors);
  if (events.onScreenNavigate)
    guarded.onScreenNavigate = hostCall(events.onScreenNavigate, errors);
  if (events.onSelectionChange)
    guarded.onSelectionChange = hostCall(events.onSelectionChange, errors);
  return guarded;
}

function hostRef(
  ref: Ref<MoklyViewerHandle> | undefined,
  errors: HostErrors,
): Ref<MoklyViewerHandle> | undefined {
  if (typeof ref !== "function") return ref;
  return (handle) => {
    const cleanup = hostCall(ref, errors)(handle);
    return typeof cleanup === "function" ? hostCall(cleanup, errors) : cleanup;
  };
}

// An absent slot stays absent: the layout shows the empty state only for one.
function hostSlots(slots: ViewerSlots, errors: HostErrors): ViewerSlots {
  const content = (node: ReactNode) => (
    <HostContent mark={errors.mark}>{node}</HostContent>
  );
  const guarded: ViewerSlots = { ...slots };
  const { sidePanel, stageOverlay } = slots;
  for (const name of [
    "emptyState",
    "railEnd",
    "railStart",
    "topBarEnd",
    "topBarStart",
  ] as const)
    if (slots[name] !== undefined) guarded[name] = content(slots[name]);
  if (sidePanel)
    guarded.sidePanel = { ...sidePanel, content: content(sidePanel.content) };
  if (stageOverlay)
    guarded.stageOverlay = {
      ...stageOverlay,
      content: content(stageOverlay.content),
    };
  return guarded;
}

function hostMarkers(
  markers: readonly ViewerMarker[],
  errors: HostErrors,
): readonly ViewerMarker[] {
  return markers.map((marker) => ({
    ...marker,
    content: <HostContent mark={errors.mark}>{marker.content}</HostContent>,
  }));
}

/**
 * The host's props for the shell below the catcher. Each host callback, ref,
 * slot, and marker records the value that it throws in `errors`.
 */
export function useHostProps(
  props: MoklyViewerProps,
  errors: HostErrors,
): MoklyViewerProps {
  const ref = useMemo(() => hostRef(props.ref, errors), [props.ref, errors]);
  const slots = useMemo(
    () => props.slots && hostSlots(props.slots, errors),
    [props.slots, errors],
  );
  const markers = useMemo(
    () => props.markers && hostMarkers(props.markers, errors),
    [props.markers, errors],
  );
  return {
    ...props,
    ...hostEvents(props, errors),
    ...(ref === undefined ? {} : { ref }),
    ...(slots ? { slots } : {}),
    ...(markers ? { markers } : {}),
  };
}
