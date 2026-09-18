import type { ReactNode } from "react";

import {
  useRenderedAppearance,
  type AppearanceChoice,
} from "../../../parts/appearance.js";
import type { DesignDestination } from "../../../parts/destinations.js";
import { MiniWelcome } from "../../../parts/mini_screens.js";
import { NavTree } from "../../../parts/nav.js";
import {
  ScreenHead,
  Shell,
  ViewSwitch,
  type ArtboardViewport,
} from "../../../parts/shell.js";
import { BrowserFrame, PhoneFrame } from "../../../parts/stage.js";

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
  const rendered = useRenderedAppearance();
  return (
    <Shell
      design={design}
      appearanceChoice={appearanceChoice ?? rendered}
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

/** The light Welcome preview the appearance screens place on their stage. */
export function WelcomeShot({ viewport }: { viewport: ArtboardViewport }) {
  return viewport === "desktop" ? (
    <BrowserFrame address="example.test/welcome">
      <MiniWelcome />
    </BrowserFrame>
  ) : (
    <PhoneFrame small>
      <MiniWelcome compact />
    </PhoneFrame>
  );
}

interface AppearanceHeadProps {
  crumbs?: readonly string[];
  idChip: string;
  /** Selected preview; omit the control on a route with no device previews. */
  preview?: "both" | "desktop" | "mobile" | "none";
  title: string;
  viewport: ArtboardViewport;
}

/** Selected appearance screens keep the ordinary header and preview controls. */
export function AppearanceHead({
  crumbs,
  idChip,
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
      crumbs={crumbs ?? ["Example", "Screens"]}
      idChip={idChip}
      title={title}
    />
  );
}
