/**
 * The layout of the Browse shell: the standalone root with its skip link, top
 * bar, navigation, and main region, the route status that announces each
 * navigation, and the state that takes a viewer root's place while it has no
 * shell to show. An embedded root lays out the same parts with its host's
 * slots.
 */

import type { ReactNode, Ref } from "react";

import type { Appearance } from "../appearance-selector/appearance-selector.js";
import { EmptyState, type EmptyStateRoot } from "../empty-state/empty-state.js";

import { rootClassName, type ShellResizing } from "./root-marks.js";

export type { ShellResizing } from "./root-marks.js";

/** The link that takes a keyboard reader past the chrome to the main region. */
export function SkipLink({ href }: { href: string }) {
  return (
    <a className="mbk-skip-link mbk-reset" href={href}>
      Skip to content
    </a>
  );
}

/** The row below the top bar: the navigation beside the main region. */
export function ShellBody({ children }: { children?: ReactNode }) {
  return <div className="mbk-body mbk-reset">{children}</div>;
}

/** The polite status that announces each navigation to a screen reader. */
export function RouteStatus({
  children,
  id,
}: {
  /** The announcement of the last navigation. */
  children?: ReactNode;
  id: string;
}) {
  return (
    <p
      aria-atomic="true"
      aria-live="polite"
      className="mbk-route-status mbk-reset"
      id={id}
      role="status"
    >
      {children}
    </p>
  );
}

/**
 * The main region, which holds the routed view. It takes focus after a
 * navigation and is the target of the skip link.
 */
export function MainRegion({
  baseline,
  children,
  id,
  ref,
}: {
  /** The digest of a removed entry's record, as `data-mokly-baseline`. */
  baseline?: string | undefined;
  children?: ReactNode;
  id: string;
  /** Receives the region, which the host focuses after a navigation. */
  ref?: Ref<HTMLElement> | undefined;
}) {
  return (
    <main
      className="mbk-main mbk-reset"
      data-mokly-view=""
      data-mokly-baseline={baseline}
      id={id}
      ref={ref}
      tabIndex={-1}
    >
      {children}
    </main>
  );
}

/**
 * The root of the standalone shell. It carries the shell's root class, which
 * holds the theme, and states its appearance and its preview scheme. It marks
 * a drag of a separator and an expanded browser window for the stylesheets.
 */
export function ShellLayout({
  announcement,
  colorScheme,
  drawerOpen,
  frameExpanded,
  main,
  mainHref,
  navigation,
  ref,
  resizing,
  statusId,
  theme,
  topBar,
}: {
  /** The route status's announcement of the last navigation. */
  announcement: string;
  /** The scheme of the shown previews, as `data-mokly-color-scheme`. */
  colorScheme: "dark" | "light";
  /** Whether the navigation drawer of a narrow shell is open. */
  drawerOpen: boolean;
  /**
   * Whether a browser window is expanded over the shell, which marks the root
   * with `frame-expanded` and shows the scrim below the window.
   */
  frameExpanded?: boolean | undefined;
  /** The main region with the routed view. */
  main: ReactNode;
  /** The address of the main region, for the skip link. */
  mainHref: string;
  navigation: ReactNode;
  /** Receives the shell root. */
  ref?: Ref<HTMLDivElement> | undefined;
  /**
   * The separator that the reader drags, which marks the root with
   * `mbk-inspector-resizing` or `mbk-nav-resizing`: the whole shell keeps the
   * drag's cursor, and no frame takes the pointer.
   */
  resizing?: ShellResizing | undefined;
  statusId: string;
  /** The appearance that the root states, as `data-mokly-theme`. */
  theme: Appearance;
  topBar: ReactNode;
}) {
  return (
    <div
      className={rootClassName("mbk", { frameExpanded, resizing })}
      data-drawer={drawerOpen ? "open" : "closed"}
      data-mokly-color-scheme={colorScheme}
      data-mokly-shell=""
      data-mokly-theme={theme}
      ref={ref}
    >
      <SkipLink href={mainHref} />
      {topBar}
      <ShellBody>
        {navigation}
        {main}
      </ShellBody>
      <RouteStatus id={statusId}>{announcement}</RouteStatus>
    </div>
  );
}

/** What a viewer root shows while it has no shell to show. */
export type RootStateKind =
  | {
      state: "loading";
      /** Receives the state, which the host focuses after Try again. */
      focusRef?: Ref<HTMLDivElement> | undefined;
    }
  | { state: "failed"; onRetry: () => void }
  | {
      state: "version";
      /** The headline, which the host's error report shares. */
      message: string;
      /**
       * Reloads the page. With it, the state offers Reload and carries
       * `data-mokly-version-error`, as the standalone shell's state does.
       */
      onReload?: (() => void) | undefined;
    }
  | { state: "unavailable" };

/**
 * The state that takes a viewer root's place: the catalogue loads, cannot be
 * loaded, or needs a compatible viewer, or the requested view is unavailable.
 */
export function RootState(props: RootStateKind & { root: EmptyStateRoot }) {
  const { root } = props;
  switch (props.state) {
    case "loading":
      return (
        <EmptyState
          body="Loading catalogue…"
          busy
          focusRef={props.focusRef}
          root={root}
        />
      );
    case "failed":
      return (
        <EmptyState
          action={{ label: "Try again", onClick: props.onRetry }}
          role="alert"
          root={root}
          title="The catalogue could not be loaded"
        />
      );
    case "version":
      return (
        <EmptyState
          action={
            props.onReload === undefined
              ? undefined
              : { label: "Reload", onClick: props.onReload }
          }
          mark={
            props.onReload === undefined
              ? undefined
              : "data-mokly-version-error"
          }
          role="alert"
          root={root}
          title={props.message}
        />
      );
    case "unavailable":
      return (
        <EmptyState role="alert" root={root}>
          The requested view is unavailable.
        </EmptyState>
      );
  }
}
