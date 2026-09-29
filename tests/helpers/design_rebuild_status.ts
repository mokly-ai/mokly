/** One rebuild status artboard and what it depicts. */
export interface RebuildState {
  id: string;
  route: string;
  /** The failure notice, collapsed or disclosed; absent once changes load. */
  notice: "collapsed" | "open" | undefined;
  /** Delayed progress shows in the top bar. */
  updating: boolean;
  /** The existing artboard whose workspace this state reuses unchanged. */
  workspace: string;
  /** The canonical artboard whose controls and links this state keeps. */
  navigation: string;
}

/** The five states in catalogue order; the first is the canonical screen. */
export const REBUILD_STATES: readonly RebuildState[] = [
  {
    id: "design-rebuild-failure",
    route: "design/rebuild-status/failure.html",
    notice: "collapsed",
    updating: false,
    workspace: "design-interactive-static",
    navigation: "design-browse-screen",
  },
  {
    id: "design-rebuild-details",
    route: "design/rebuild-status/details.html",
    notice: "open",
    updating: false,
    workspace: "design-interactive-static",
    navigation: "design-browse-screen",
  },
  {
    id: "design-rebuild-updating",
    route: "design/rebuild-status/updating.html",
    notice: undefined,
    updating: true,
    workspace: "design-interactive-static",
    navigation: "design-browse-screen",
  },
  {
    id: "design-rebuild-failure-updating",
    route: "design/rebuild-status/failure-updating.html",
    notice: "collapsed",
    updating: true,
    workspace: "design-interactive-static",
    navigation: "design-browse-screen",
  },
  {
    id: "design-rebuild-live-component",
    route: "design/rebuild-status/live-component.html",
    notice: "collapsed",
    updating: false,
    workspace: "design-interactive-component",
    navigation: "design-interactive-component",
  },
];

/** The approved product copy, recorded in the rebuild status design. */
export const NOTICE_COPY = {
  headline: "Your latest changes couldn’t be loaded.",
  explanation: "You’re seeing the last working version.",
  show: "Show details",
  hide: "Hide details",
} as const;
export const PROGRESS_COPY = "Updating…";

/** Words the headline, explanation, disclosure and progress never use. */
export const TECHNICAL_WORDS =
  /build|bundle|generation|watch|rebuild|schema|serve|esbuild|html|json/iu;

/** The generated fragment path for one state in one viewport. */
export function fragment(
  state: RebuildState,
  viewport: "desktop" | "mobile",
): string {
  return state.route.replace(/\.html$/u, `.${viewport}.html`);
}
