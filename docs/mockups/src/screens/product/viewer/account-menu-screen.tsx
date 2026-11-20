import { MockLink } from "@mokly/mokly";
import type { Viewport } from "@mokly/mokly";

import { CatalogueLinks } from "../../../components/catalogue-links";
import { sample } from "../../../fixtures/product";
import { publication } from "../../../fixtures/publications";
import { useMockupRenderContext } from "../../../render-context";

import { AccountMenu, MorePopover, MoreSheetRows } from "./account-menu";
import { accountMenuPath } from "./account-trigger";
import { ViewerChrome } from "./chrome";
import { ViewerPanelScreen } from "./screen";

/** The ready viewer that the menus open over, and that Close returns to. */
const viewerPath = "product/viewer/standalone";

/** Where the menus' Settings and Sign out lead in the catalogue. */
function MenuDestinations() {
  return (
    <CatalogueLinks>
      <MockLink to="product/settings/sections">Settings</MockLink>
      <MockLink to="product/account/sign-in">Sign in</MockLink>
    </CatalogueLinks>
  );
}

/**
 * The account menu open over the ready viewer. A desktop drawing draws both
 * bars for the switch in `viewer.css` to show one, so it opens the account
 * menu under the full bar's avatar and More under the compact bar's More,
 * each in a layer that only its composition shows. Both are non-modal
 * popovers, so the viewer beneath stays the page, with its own heading and
 * landmark. A phone opens More as a bottom sheet over the inert viewer,
 * exactly as a panel opens, so the sheet takes the document's main landmark
 * and heading.
 */
export function ViewerAccountMenuScreen({ viewport }: { viewport: Viewport }) {
  const { colorScheme } = useMockupRenderContext();
  if (viewport === "mobile")
    return (
      <>
        <ViewerPanelScreen
          id={viewerPath}
          state="default"
          viewport={viewport}
          title="More"
          close={viewerPath}
          screen={accountMenuPath}
        >
          <MoreSheetRows scheme={colorScheme} />
        </ViewerPanelScreen>
        <MenuDestinations />
      </>
    );
  return (
    <>
      <div
        className="folio-root fo-viewer-screen"
        data-mkc-screen={accountMenuPath}
      >
        <ViewerChrome
          viewport={viewport}
          heading={sample.project + " · " + publication.branch}
          published
        />
        <div className="fo-canvas-menu-layer fo-full-bar-only">
          <AccountMenu scheme={colorScheme} />
        </div>
        <div className="fo-canvas-menu-layer fo-compact-bar-only">
          <MorePopover scheme={colorScheme} />
        </div>
      </div>
      <MenuDestinations />
    </>
  );
}
