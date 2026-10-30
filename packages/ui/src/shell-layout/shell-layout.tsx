/**
 * The layout of the Browse shell: the standalone root with its skip link, top
 * bar, navigation, and main region, the route status that announces each
 * navigation, and the state that takes a viewer root's place while it has no
 * shell to show. An embedded root lays out the same parts with its host's
 * slots.
 */

import type { ReactNode, Ref } from "react";

import { EmptyState, type EmptyStateRoot } from "../empty-state/empty-state.js";

/** The link that takes a keyboard reader past the chrome to the main region. */
export function SkipLink({ href }: { href: string }) {
  return (
    <a className="mbk-skip-link" href={href}>
      Skip to content
    </a>
  );
}

/** The row below the top bar: the navigation beside the main region. */
export function ShellBody({ children }: { children?: ReactNode }) {
  return <div className="mbk-body">{children}</div>;
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
      className="mbk-route-status"
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
}: {
  /** The digest of a removed entry's record, as `data-mokly-baseline`. */
  baseline?: string | undefined;
  children?: ReactNode;
  id: string;
}) {
  return (
    <main
      className="mbk-main"
      data-mokly-view=""
      data-mokly-baseline={baseline}
      id={id}
      tabIndex={-1}
    >
      {children}
    </main>
  );
}

/** The root of the standalone shell. */
export function ShellLayout({
  announcement,
  drawerOpen,
  main,
  mainHref,
  navigation,
  ref,
  statusId,
  topBar,
}: {
  /** The route status's announcement of the last navigation. */
  announcement: string;
  /** Whether the navigation drawer of a narrow shell is open. */
  drawerOpen: boolean;
  /** The main region with the routed view. */
  main: ReactNode;
  /** The address of the main region, for the skip link. */
  mainHref: string;
  navigation: ReactNode;
  /** Receives the shell root. */
  ref?: Ref<HTMLDivElement> | undefined;
  statusId: string;
  topBar: ReactNode;
}) {
  return (
    <div
      className="mbk"
      data-drawer={drawerOpen ? "open" : "closed"}
      data-mokly-shell=""
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
