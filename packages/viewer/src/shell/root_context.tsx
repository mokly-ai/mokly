/** Shell-owned package refs and drag state shared by its containers. */

import {
  createContext,
  createRef,
  useCallback,
  useContext,
  useState,
} from "react";
import type { ReactNode } from "react";

import type { HostSlotName } from "@mokly/ui/embedded-layout";
import type { ShellResizing } from "@mokly/ui/shell-layout";

import { ElementRefs } from "./element_refs.js";

export type ScrollRegion = "stage" | "flow" | "embed" | "inspector";

/** The package elements that input, focus, and history need to reach. */
export class ShellElements {
  readonly root = createRef<HTMLDivElement>();
  readonly main = createRef<HTMLElement>();
  readonly navigation = createRef<HTMLElement>();
  readonly tagToggle = createRef<HTMLButtonElement>();
  readonly tagPicker = createRef<HTMLDivElement>();
  readonly expandedBrowser = createRef<HTMLDivElement>();
  readonly markers = createRef<HTMLDivElement>();
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

const RootContext = createContext<ShellRoot | undefined>(undefined);

/** Keep one ref registry and one drag state for either delivery. */
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
  return (
    <RootContext value={{ elements, element, ref, resizing, setResizing }}>
      {children}
    </RootContext>
  );
}

/** Read shell refs when mounted, allowing inert component-only renders. */
export function useShellRoot(): ShellRoot | undefined {
  return useContext(RootContext);
}
