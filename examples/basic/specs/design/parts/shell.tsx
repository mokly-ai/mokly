import type { ReactNode } from "react";

import {
  MainRegion,
  ShellLayout,
} from "../../../../../packages/ui/src/shell-layout/shell-layout.js";
import { CANVAS_PAGES } from "../canvas/parts/destinations.js";
import { screenHeader } from "../library/chrome/screen-header.js";
import { optional, useDesignInstance } from "../library/composition.js";
import {
  viewControls,
  type ViewControlsProps,
} from "../library/controls/view-controls.js";

import { DesignAppearanceScope, useRenderedAppearance } from "./appearance.js";
import { useDepictedView, type HighlightState } from "./depicted_view.js";
import { DesignNavigation, useDesignNavigation } from "./design_navigation.js";
import type { DesignDestination } from "./destinations.js";
import { TopBar } from "./top_bar.js";

/** Rendering target for a design mockup artboard. */
export type ArtboardViewport = "desktop" | "mobile";

interface ShellProps {
  design: DesignDestination;
  changedViews?: readonly ChangedView[] | undefined;
  activeTag?: string | undefined;
  children: ReactNode;
  /** The catalogue navigation of a desktop render. */
  nav: ReactNode;
  searchValue?: string | undefined;
  tagPickerOpen?: boolean | undefined;
  viewport: ArtboardViewport;
}

/** The ids of the main region and the route status, one shell per document. */
const MAIN_ID = "mb-main";
const STATUS_ID = "mb-route-status";

/**
 * The shipped shell root of one design mockup, in the frame that carries the
 * artboard's render flag: `mbk-shell--mobile` draws the narrow shell of a
 * mobile render at every width, without the catalogue navigation. The root
 * states the rendered appearance as its theme and its previews' scheme, so
 * the package components draw in the shipped palette.
 */
export function Shell({
  activeTag,
  changedViews,
  children,
  design,
  nav,
  searchValue,
  tagPickerOpen,
  viewport,
}: ShellProps) {
  return (
    <DesignNavigation design={design}>
      <DesignAppearanceScope>
        <ShellRoot
          flag={viewport}
          navigation={viewport === "mobile" ? undefined : nav}
          topBar={
            <ShellTopBar
              activeTag={activeTag}
              changedViews={changedViews}
              searchValue={searchValue}
              tagPickerOpen={tagPickerOpen}
              viewport={viewport}
            />
          }
        >
          {children}
        </ShellRoot>
      </DesignAppearanceScope>
    </DesignNavigation>
  );
}

function ShellTopBar({
  changedViews,
  ...props
}: Pick<
  ShellProps,
  "activeTag" | "changedViews" | "searchValue" | "tagPickerOpen" | "viewport"
>) {
  const scheme = useRenderedAppearance();
  return (
    <TopBar
      appearanceChanged={changedViews?.some((view) => view.scheme !== scheme)}
      {...props}
    />
  );
}

/** The flag frame and the shipped root around one artboard's shell. */
function ShellRoot({
  children,
  flag,
  navigation,
  topBar,
}: {
  children: ReactNode;
  flag: ArtboardViewport;
  navigation: ReactNode;
  topBar: ReactNode;
}) {
  const scheme = useRenderedAppearance();
  const drawer = useDesignNavigation().drawer;
  return (
    <div className={`mbk-shell-frame mbk-shell--${flag}`}>
      <ShellLayout
        announcement=""
        colorScheme={scheme}
        drawerOpen={drawer?.open ?? false}
        main={<MainRegion id={MAIN_ID}>{children}</MainRegion>}
        mainHref={`#${MAIN_ID}`}
        navigation={navigation}
        statusId={STATUS_ID}
        theme={scheme}
        topBar={topBar}
      />
    </div>
  );
}

/** A breadcrumb label, optionally opening the entry it names. */
export type Crumb = string | { label: string; to: DesignDestination };

interface ScreenHeadProps {
  action?: ReactNode;
  crumbs: readonly Crumb[];
  /** The depicted entry's path, shown in the path chip. */
  path?: string;
  title: string;
}

/** The white head band: breadcrumbs, title, and path chip. */
export function ScreenHead({ action, crumbs, path, title }: ScreenHeadProps) {
  return (
    <screenHeader.Component
      moklyInstance={useDesignInstance("header")}
      title={title}
      crumbs={[
        {
          key: "home",
          label: "Catalogue home",
          destination: CANVAS_PAGES.home,
        },
        ...crumbs.map((item) =>
          typeof item === "string"
            ? { key: item, label: item }
            : { key: item.label, label: item.label, destination: item.to },
        ),
      ]}
      {...optional("path", path)}
      actions={action}
    />
  );
}

/** One viewport and color scheme pairing whose render changed on this branch. */
type ChangedView = NonNullable<ViewControlsProps["changedViews"]>[number];

/** The view controls props that draw one highlight state. */
export function highlightProps(
  state: HighlightState,
): Pick<ViewControlsProps, "highlight" | "unavailable"> {
  return state === "available" || state === "on"
    ? { highlight: state === "on" }
    : { highlight: false, unavailable: state };
}

interface ViewSwitchProps {
  active: "both" | "desktop" | "mobile";
  /** Views other than the shown one whose render changed on this branch. */
  changedViews?: readonly ChangedView[] | undefined;
}

/**
 * The view controls of a selected screen's header: the viewport selection,
 * and the Highlight components toggle in the state that the shell shows for
 * the view that the workspace depicts.
 */
export function ViewSwitch({ active, changedViews }: ViewSwitchProps) {
  const view = useDepictedView();
  return (
    <viewControls.Component
      moklyInstance={useDesignInstance("viewport")}
      selection={active}
      {...highlightProps(view.highlight)}
      {...optional("changedViews", changedViews)}
    />
  );
}
