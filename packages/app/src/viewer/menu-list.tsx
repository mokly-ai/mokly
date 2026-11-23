import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
  RefObject,
} from "react";

import { Icon } from "../components/icons";

/**
 * One row of a cloud menu. An action runs a press handler, and a link is a
 * real link to a page of the public site, which the browser follows as it
 * follows any link; it draws the external glyph in place of a glyph of its
 * own. `@firna/ui` menu rows take no address, so the cloud draws these rows
 * itself, in the package's menu row metrics.
 */
export type MenuItem =
  | {
      kind: "action";
      id: string;
      label: string;
      glyph: ReactNode;
      disabled?: boolean;
      onSelect: () => void;
    }
  | {
      kind: "link";
      id: string;
      label: string;
      href: string;
      /** What following the link does in this page: close the menu. */
      onFollow: () => void;
    };

/** The roving focus that every menu of one popover or sheet shares. */
interface MenuFocus {
  /** The row that the Tab key reaches: the last focused, else the first. */
  current: string;
  setCurrent: (id: string) => void;
  /** Keep one enabled row's element, or forget it with `null`. */
  register: (id: string, element: HTMLElement | null) => void;
}

const MenuFocusContext = createContext<MenuFocus | null>(null);

/** The row a key moves focus to, of `count` rows, from the row at `index`. */
function movedTo(key: string, index: number, count: number) {
  if (key === "ArrowDown") return (index + 1) % count;
  if (key === "ArrowUp") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return undefined;
}

/** Order two elements as the document does. */
function documentOrder(first: HTMLElement, second: HTMLElement): number {
  return first.compareDocumentPosition(second) &
    Node.DOCUMENT_POSITION_FOLLOWING
    ? -1
    : 1;
}

/**
 * The body of a popover or a sheet that holds menus, and the one keyboard
 * model over all of their rows. Each menu is one tab stop: the row that last
 * had focus, at first `first`. ArrowDown and ArrowUp move focus to the next
 * and previous enabled row, across every menu of the body, and wrap; Home
 * and End go to the first and the last. Enter and Space press a row, as a
 * button and a link take them, and Space follows a link too. A key pressed
 * anywhere else in the body, such as in the Theme choice, is left alone.
 * `firstRef` receives the first row, which a popover focuses as it opens.
 */
export function MenuBody({
  first,
  firstRef,
  className,
  style,
  children,
}: {
  first: string;
  firstRef?: RefObject<HTMLElement | null>;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const rows = useRef(new Map<string, HTMLElement>());
  const [current, setCurrent] = useState(first);
  const register = useCallback(
    (id: string, element: HTMLElement | null) => {
      if (element) rows.current.set(id, element);
      else rows.current.delete(id);
      if (firstRef && id === first) firstRef.current = element;
    },
    [first, firstRef],
  );
  const focus = useMemo(
    () => ({ current, setCurrent, register }),
    [current, register],
  );
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const ordered = [...rows.current.values()].sort(documentOrder);
    const index = ordered.findIndex((row) => row === event.target);
    if (index < 0) return;
    const next = movedTo(event.key, index, ordered.length);
    if (next !== undefined) {
      event.preventDefault();
      ordered[next]?.focus();
      return;
    }
    const row = ordered[index];
    if (event.key === " " && row instanceof HTMLAnchorElement) {
      event.preventDefault();
      row.click();
    }
  };
  return (
    <MenuFocusContext.Provider value={focus}>
      <div className={className} style={style} onKeyDown={onKeyDown}>
        {children}
      </div>
    </MenuFocusContext.Provider>
  );
}

/**
 * One row's glyph and label. Every glyph sits in a column of one width, so
 * every label in the menu starts at one edge.
 */
function RowParts({ glyph, label }: { glyph: ReactNode; label: string }) {
  return (
    <>
      <span className="fo-canvas-menu-glyph">{glyph}</span>
      <span className="fo-canvas-menu-text">{label}</span>
    </>
  );
}

/** A pointer moving over a row makes it the keyboard's row, as Firna's do. */
function followPointer(event: PointerEvent<HTMLElement>) {
  const row = event.currentTarget;
  if (event.pointerType === "mouse" && document.activeElement !== row)
    row.focus({ preventScroll: true });
}

function MenuRow({ item }: { item: MenuItem }) {
  const focus = useContext(MenuFocusContext);
  const register = focus?.register;
  const enabled = item.kind === "link" || item.disabled !== true;
  const ref = useCallback(
    (element: HTMLElement | null) =>
      register?.(item.id, enabled ? element : null),
    [register, item.id, enabled],
  );
  const shared = {
    className: "fo-canvas-menu-row",
    role: "menuitem",
    tabIndex: focus?.current === item.id ? 0 : -1,
    onFocus: () => focus?.setCurrent(item.id),
    onPointerMove: followPointer,
  };
  if (item.kind === "link")
    return (
      <a {...shared} ref={ref} href={item.href} onClick={item.onFollow}>
        <RowParts glyph={<Icon name="external" />} label={item.label} />
      </a>
    );
  return (
    <button
      {...shared}
      ref={ref}
      type="button"
      disabled={item.disabled}
      aria-disabled={item.disabled || undefined}
      onClick={item.onSelect}
    >
      <RowParts glyph={item.glyph} label={item.label} />
    </button>
  );
}

/** One menu: a named list of rows, inside a `MenuBody`. */
export function MenuList({
  label,
  items,
}: {
  label: string;
  items: readonly MenuItem[];
}) {
  return (
    <div className="fo-canvas-menu-list" role="menu" aria-label={label}>
      {items.map((item) => (
        <MenuRow key={item.id} item={item} />
      ))}
    </div>
  );
}
