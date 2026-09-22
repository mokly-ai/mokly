import type { ReactNode } from "react";

import type { ChangeStatus } from "../components/parts/comparison_fixtures.js";
import { previewModeProps } from "../components/parts/view_controls.js";
import { screenHeader } from "../library/chrome/screen-header.js";
import { optional, useDesignInstance } from "../library/composition.js";
import {
  viewControls,
  type ViewControlsProps,
} from "../library/controls/view-controls.js";

import { DesignNavigation, useDesignNavigation } from "./design_navigation.js";
import { DESTINATIONS, type DesignDestination } from "./destinations.js";
import { TopBar } from "./top_bar.js";

/** Rendering target for a design mockup artboard. */
export type ArtboardViewport = "desktop" | "mobile";

interface ShellProps {
  design: DesignDestination;
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
  if (viewport === "desktop") {
    return (
      <DesignNavigation design={design}>
        <div className="ce-design">
          <div className="mbk-shell mbk-shell--desktop">
            <TopBar
              menuPresentation={menuPresentation}
              searchPlaceholder={searchPlaceholder}
              drawerOpen={design === DESTINATIONS.navigation}
              activeTag={activeTag}
              searchValue={searchValue}
              tagPickerOpen={tagPickerOpen}
              viewport={viewport}
            />
            <div className="mbk-body">
              {nav}
              <main className="mbk-main">{children}</main>
            </div>
          </div>
        </div>
      </DesignNavigation>
    );
  }
  return (
    <DesignNavigation design={design}>
      <div className="ce-design">
        <div className="mbk-shell mbk-shell--mobile">
          <TopBar
            menuPresentation={menuPresentation}
            searchPlaceholder={searchPlaceholder}
            drawerOpen={design === DESTINATIONS.navigation}
            activeTag={activeTag}
            searchValue={searchValue}
            tagPickerOpen={tagPickerOpen}
            viewport={viewport}
          />
          <main className="mbk-main">{children}</main>
          {aside}
        </div>
      </div>
    </DesignNavigation>
  );
}

/** A breadcrumb label, optionally opening the entry it names. */
export type Crumb = string | { label: string; to: DesignDestination };

interface ScreenHeadProps {
  accessibleControls?: boolean;
  action?: ReactNode;
  crumbs: readonly Crumb[];
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
        ...crumbs.map((item) =>
          typeof item === "string"
            ? { key: item, label: item }
            : { key: item.label, label: item.label, destination: item.to },
        ),
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

/** One viewport and color scheme pairing whose render changed on this branch. */
export type ChangedView = NonNullable<
  ViewControlsProps["changedViews"]
>[number];

interface ViewSwitchProps {
  active: "both" | "desktop" | "mobile";
  /** Views other than the shown one whose render changed on this branch. */
  changedViews?: readonly ChangedView[] | undefined;
}

/** Viewport selection control shown in a selected screen header. */
export function ViewSwitch({ active, changedViews }: ViewSwitchProps) {
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
      {...previewModeProps(navigation.preview)}
      {...optional("changedViews", changedViews)}
    />
  );
}
