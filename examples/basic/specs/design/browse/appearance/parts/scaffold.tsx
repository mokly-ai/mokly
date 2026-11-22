import type { ReactNode } from "react";

import type { AppearanceChoice } from "../../../parts/appearance.js";
import type { DesignDestination } from "../../../parts/destinations.js";
import { SCREEN_CRUMBS } from "../../../parts/entry_paths.js";
import { NavTree } from "../../../parts/nav.js";
import {
  ScreenHead,
  Shell,
  ViewSwitch,
  type ArtboardViewport,
  type Crumb,
} from "../../../parts/shell.js";

interface AppearanceShellProps {
  activeLabel?: string | undefined;
  /** The depicted selector's value; it follows the rendered scheme by default. */
  appearanceChoice?: AppearanceChoice | undefined;
  aside?: ReactNode;
  children: ReactNode;
  /** Depicts a desktop window narrower than the layout breakpoint. */
  collapsed?: boolean | undefined;
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
  collapsed,
  design,
  nav,
  viewport,
}: AppearanceShellProps) {
  return (
    <Shell
      design={design}
      appearanceChoice={appearanceChoice}
      collapsed={collapsed}
      viewport={viewport}
      nav={
        viewport === "desktop"
          ? (nav ?? <NavTree activeLabel={activeLabel} />)
          : null
      }
      aside={aside}
    >
      {children}
    </Shell>
  );
}

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
 * The appearance header carries the view controls only: the catalogue's one
 * scheme setting lives in the top bar's Appearance selector. Its Highlight
 * components switch shows the state of the view that the workspace depicts.
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
        : {
            action: <ViewSwitch active={selection} />,
          })}
      crumbs={crumbs ?? SCREEN_CRUMBS}
      path={path}
      title={title}
    />
  );
}
