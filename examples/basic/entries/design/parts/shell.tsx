import type { ReactNode } from "react";

import type { ChangeStatus } from "../components/parts/comparison_fixtures.js";
import { screenHeader } from "../library/chrome/screen-header.js";
import { optional, useDesignInstance } from "../library/composition.js";
import { viewControls } from "../library/controls/view-controls.js";

import { DesignAppearanceScope, type AppearanceChoice } from "./appearance.js";
import { DesignNavigation, useDesignNavigation } from "./design_navigation.js";
import { DESTINATIONS, type DesignDestination } from "./destinations.js";
import { TopBar } from "./top_bar.js";

/** Rendering target for a design mockup artboard. */
export type ArtboardViewport = "desktop" | "mobile";

interface ShellProps {
  design: DesignDestination;
  /** Draws the depicted Appearance selector holding this setting. */
  appearanceChoice?: AppearanceChoice | undefined;
  searchPlaceholder?: string | undefined;
  activeTag?: string | undefined;
  aside?: ReactNode;
  children: ReactNode;
  menuPresentation?: "text" | "icon" | undefined;
  nav: ReactNode;
  searchValue?: string | undefined;
  tagPickerOpen?: boolean | undefined;
  viewport: ArtboardViewport;
}

/** The Mokly shell scaffold for one design mockup. */
export function Shell({
  activeTag,
  appearanceChoice,
  aside,
  children,
  design,
  menuPresentation,
  nav,
  searchValue,
  searchPlaceholder,
  tagPickerOpen,
  viewport,
}: ShellProps) {
  const bar = (
    <TopBar
      menuPresentation={menuPresentation}
      searchPlaceholder={searchPlaceholder}
      drawerOpen={design === DESTINATIONS.navigation}
      activeTag={activeTag}
      appearanceChoice={appearanceChoice}
      searchValue={searchValue}
      tagPickerOpen={tagPickerOpen}
      viewport={viewport}
    />
  );
  return (
    <DesignNavigation design={design}>
      <DesignAppearanceScope>
        {viewport === "desktop" ? (
          <div className="mbk-shell mbk-shell--desktop">
            {bar}
            <div className="mbk-body">
              {nav}
              <main className="mbk-main">{children}</main>
            </div>
          </div>
        ) : (
          <div className="mbk-shell mbk-shell--mobile">
            {bar}
            <main className="mbk-main">{children}</main>
            {aside}
          </div>
        )}
      </DesignAppearanceScope>
    </DesignNavigation>
  );
}

interface ScreenHeadProps {
  accessibleControls?: boolean;
  action?: ReactNode;
  crumbs: readonly string[];
  idChip?: string;
  comparisonMode?: "current" | "difference" | "overlay" | "side-by-side";
  comparisons?: boolean;
  status?: ChangeStatus;
  title: string;
}

/** The white head band: breadcrumbs, title, id chip, and status. */
export function ScreenHead({
  accessibleControls,
  action,
  crumbs,
  idChip,
  comparisonMode,
  comparisons = false,
  status,
  title,
}: ScreenHeadProps) {
  const navigation = useDesignNavigation();
  return (
    <screenHeader.Component
      moklyInstance={useDesignInstance("header")}
      title={title}
      crumbs={[
        {
          key: "home",
          label: "Catalogue home",
          destination: DESTINATIONS.home,
        },
        ...crumbs.map((item) => ({ key: item, label: item })),
      ]}
      comparisons={comparisons}
      mode={comparisonMode ?? "current"}
      accessible={accessibleControls ?? false}
      destinations={navigation.comparison ?? {}}
      {...optional("idChip", idChip)}
      {...optional("status", status)}
      actions={action}
    />
  );
}

interface ViewSwitchProps {
  active: "both" | "desktop" | "mobile";
}

/** Viewport selection control shown in a selected screen header. */
export function ViewSwitch({ active }: ViewSwitchProps) {
  const navigation = useDesignNavigation();
  const scheme = navigation.scheme ?? "light";
  const nextScheme = scheme === "light" ? "dark" : "light";
  return (
    <viewControls.Component
      moklyInstance={useDesignInstance("viewport")}
      selection={active}
      scheme={scheme}
      schemeDisabled={!navigation.schemeLinks?.[nextScheme]}
      destinations={navigation.schemeLinks ?? {}}
    />
  );
}
