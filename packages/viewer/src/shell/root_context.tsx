/** Shell-owned package refs and drag state shared by its containers. */

import {
  createContext,
  createRef,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import type { CanvasStageHandle } from "@mokly/ui/canvas-stage";
import type { HostSlotName } from "@mokly/ui/embedded-layout";
import type { ShellResizing } from "@mokly/ui/shell-layout";

import { ElementRefs } from "./element_refs.js";

export type ScrollRegion = "stage" | "inspector";

/** The dock's controls that a closed sheet returns focus to. */
export type DockControl = "catalogue" | "tab";

/** The package elements that input, focus, and history need to reach. */
export class ShellElements {
  readonly root = createRef<HTMLDivElement>();
  readonly main = createRef<HTMLElement>();
  readonly navigation = createRef<HTMLElement>();
  readonly tagToggle = createRef<HTMLButtonElement>();
  readonly tagPicker = createRef<HTMLDivElement>();
  readonly markers = createRef<HTMLDivElement>();
  readonly dock = new ElementRefs<DockControl, HTMLButtonElement>();
  readonly slots = new ElementRefs<HostSlotName, HTMLDivElement>();
  readonly scrolls = new ElementRefs<ScrollRegion, HTMLDivElement>();

  inTagPicker(target: Node): boolean {
    return Boolean(
      this.tagToggle.current?.contains(target) ||
      this.tagPicker.current?.contains(target),
    );
  }

  inHostSlot(target: Node): boolean {
    return Boolean(
      this.slots.contains(target) || this.markers.current?.contains(target),
    );
  }
}

interface ShellRoot {
  elements: ShellElements;
  element: HTMLDivElement | null;
  ref(element: HTMLDivElement | null): void;
  resizing: ShellResizing | undefined;
  setResizing(value: ShellResizing | undefined): void;
}

/**
 * The canvas that holds the routed entry's section, which the dock's Fit
 * refits, and the registration of a canvas while it shows.
 */
interface ShownCanvas {
  handle: CanvasStageHandle | undefined;
  show(handle: CanvasStageHandle): () => void;
}

const RootContext = createContext<ShellRoot | undefined>(undefined);
const CanvasContext = createContext<ShownCanvas | undefined>(undefined);

/** Keep one ref registry, one drag state and one shown canvas for either delivery. */
export function ShellRootProvider({ children }: { children: ReactNode }) {
  const [elements] = useState(() => new ShellElements());
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const ref = useCallback(
    (next: HTMLDivElement | null) => {
      elements.root.current = next;
      setElement(next);
    },
    [elements],
  );
  const [resizing, setResizing] = useState<ShellResizing>();
  const [handle, setHandle] = useState<CanvasStageHandle>();
  const show = useCallback((shown: CanvasStageHandle) => {
    setHandle(shown);
    return () =>
      setHandle((current) => (current === shown ? undefined : current));
  }, []);
  const canvas = useMemo(() => ({ handle, show }), [handle, show]);
  return (
    <RootContext value={{ elements, element, ref, resizing, setResizing }}>
      <CanvasContext value={canvas}>{children}</CanvasContext>
    </RootContext>
  );
}

/** Read shell refs when mounted, allowing inert component-only renders. */
export function useShellRoot(): ShellRoot | undefined {
  return useContext(RootContext);
}

/** The shown canvas, if a section stands on it, and its registration. */
export function useShownCanvas(): ShownCanvas | undefined {
  return useContext(CanvasContext);
}
