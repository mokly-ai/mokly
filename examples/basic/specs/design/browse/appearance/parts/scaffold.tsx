import type { ReactNode } from "react";

import {
  useDarkPreview,
  type AppearanceChoice,
} from "../../../parts/appearance.js";
import {
  DESTINATIONS,
  type DesignDestination,
} from "../../../parts/destinations.js";
import { SCREEN_CRUMBS } from "../../../parts/entry_paths.js";
import { SchemeWorkspace } from "../../../parts/example_workspace.js";
import { MiniWelcome } from "../../../parts/mini_screens.js";
import { NavTree, type NavNode } from "../../../parts/nav.js";
import { NAV_TREE } from "../../../parts/nav_data.js";
import {
  ScreenHead,
  Shell,
  ViewSwitch,
  type ArtboardViewport,
  type Crumb,
} from "../../../parts/shell.js";
import { BrowserFrame, PhoneFrame } from "../../../parts/stage.js";

/**
 * The canonical tree as the appearance designs draw it. Its Payment terms row
 * opens the document in the depicted appearance, so a Dark artboard stays Dark
 * and shows the document's light fallback.
 */
export const APPEARANCE_NAV_TREE: readonly NavNode[] = NAV_TREE.map((row) =>
  row.key === "payment-terms"
    ? { ...row, to: DESTINATIONS.appearanceLightOnlyCurrent }
    : row,
);

interface AppearanceShellProps {
  activeLabel?: string | undefined;
  /** The depicted selector's value; it follows the rendered scheme by default. */
  appearanceChoice?: AppearanceChoice | undefined;
  aside?: ReactNode;
  children: ReactNode;
  design: DesignDestination;
  nav?: ReactNode;
  viewport: ArtboardViewport;
}

/**
 * Appearance artboards share one scaffold, so each screen differs only in the
 * state it depicts rather than in how the catalogue is assembled. The depicted
 * appearance comes from the scheme Mokly requested for this generated file.
 */
export function AppearanceShell({
  activeLabel,
  appearanceChoice,
  aside,
  children,
  design,
  nav,
  viewport,
}: AppearanceShellProps) {
  return (
    <Shell
      design={design}
      appearanceChoice={appearanceChoice}
      viewport={viewport}
      nav={
        viewport === "desktop"
          ? (nav ?? (
              <NavTree activeLabel={activeLabel} nodes={APPEARANCE_NAV_TREE} />
            ))
          : null
      }
      aside={aside}
    >
      {children}
    </Shell>
  );
}

/** The Welcome preview the appearance screens place on their stage. */
export function WelcomeShot({ viewport }: { viewport: ArtboardViewport }) {
  const dark = useDarkPreview();
  return viewport === "desktop" ? (
    <BrowserFrame address="example.test/welcome" dark={dark}>
      <MiniWelcome />
    </BrowserFrame>
  ) : (
    <PhoneFrame small dark={dark}>
      <MiniWelcome compact />
    </PhoneFrame>
  );
}

/** The appearance artboards use the shared dual-scheme workspace. */
export const AppearanceWorkspace = SchemeWorkspace;

interface AppearanceHeadProps {
  /** Folder crumbs; a current screen's crumbs from All by default. */
  crumbs?: readonly Crumb[];
  /** The depicted entry's path, shown in the path chip. */
  path: string;
  /** Selected preview; omit the control on a route with no device previews. */
  preview?: "both" | "desktop" | "mobile" | "none";
  title: string;
  viewport: ArtboardViewport;
}

/**
 * The appearance header carries the viewport control only: the catalogue's one
 * scheme setting lives in the top bar's Appearance selector.
 */
export function AppearanceHead({
  crumbs,
  path,
  preview,
  title,
  viewport,
}: AppearanceHeadProps) {
  const selection =
    preview ??
    (viewport === "desktop" ? ("both" as const) : ("mobile" as const));
  return (
    <ScreenHead
      {...(selection === "none"
        ? {}
        : { action: <ViewSwitch active={selection} /> })}
      crumbs={crumbs ?? SCREEN_CRUMBS}
      path={path}
      title={title}
    />
  );
}
