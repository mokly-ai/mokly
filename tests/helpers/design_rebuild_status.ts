import { viewRoute } from "@mokly/viewer/data";

/** One rebuild status artboard and what it depicts. */
export interface RebuildState {
  id: string;
  /** The failure notice, collapsed or disclosed; absent once changes load. */
  notice: "collapsed" | "open" | undefined;
  /** Delayed progress shows in the top bar. */
  updating: boolean;
  /** The existing artboard whose workspace this state reuses unchanged. */
  workspace: string;
  /** The canonical artboard whose controls and links this state keeps. */
  navigation: string;
}

/** The five approved states; the first is the canonical screen. */
export const REBUILD_STATES: readonly RebuildState[] = [
  {
    id: "design/rebuild-status/failure",
    notice: "collapsed",
    updating: false,
    workspace: "design/interactive/modes/static",
    navigation: "design/browse/views/screen",
  },
  {
    id: "design/rebuild-status/details",
    notice: "open",
    updating: false,
    workspace: "design/interactive/modes/static",
    navigation: "design/browse/views/screen",
  },
  {
    id: "design/rebuild-status/updating",
    notice: undefined,
    updating: true,
    workspace: "design/interactive/modes/static",
    navigation: "design/browse/views/screen",
  },
  {
    id: "design/rebuild-status/failure-updating",
    notice: "collapsed",
    updating: true,
    workspace: "design/interactive/modes/static",
    navigation: "design/browse/views/screen",
  },
  {
    id: "design/rebuild-status/live-component",
    notice: "collapsed",
    updating: false,
    workspace: "design/interactive/workspace/component",
    navigation: "design/interactive/workspace/component",
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
  return viewRoute(state.id, viewport, "light");
}
