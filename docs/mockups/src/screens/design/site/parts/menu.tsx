/**
 * The mobile header's menu: the control at the trailing edge of the tool
 * bar and the dialog it opens. The site opens the dialog as a modal sheet
 * that drops below the tool bar over a dimmed page, and its Close menu
 * control takes the menu control's place in the bar. The open state draws
 * the same sheet in place; a scrim depicts the dimmed page because a static
 * document has no top layer. Above the breakpoint the tool bar lists the
 * same destinations and the control is not drawn.
 */

import { MockLink } from "@mokly/mokly";

import { SiteIcon } from "./icons.js";
import {
  EXTERNAL_LINKS,
  GET_STARTED_SCREEN,
  SITE_NAV_SCREENS,
  currentPage,
  type SiteScreen,
} from "./links.js";

/** The control that opens the menu, drawn on the mobile tool bar only. */
export function SiteMenuButton({ open }: { open: boolean }) {
  return (
    <button
      aria-controls="site-menu"
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label="Menu"
      className="site-menu-button"
      type="button"
    >
      <SiteIcon name="menu" size={20} />
    </button>
  );
}

/**
 * The open menu: the scrim over the page, then the sheet with its close
 * control, the site's destinations and Get started.
 */
export function SiteMenu({ active }: { active: SiteScreen }) {
  return (
    <>
      <div aria-hidden="true" className="site-menu-scrim" />
      <dialog aria-label="Menu" className="site-menu" id="site-menu" open>
        <div className="site-menu-panel">
          <div className="site-menu-head">
            <button
              aria-label="Close menu"
              className="site-menu-close"
              type="button"
            >
              <SiteIcon name="close" size={20} />
            </button>
          </div>
          <nav aria-label="Main" className="site-menu-nav">
            {SITE_NAV_SCREENS.map(([screen, label]) => (
              <MockLink
                aria-current={currentPage(active, screen)}
                className="site-menu-link"
                key={screen}
                to={screen}
              >
                {label}
              </MockLink>
            ))}
            <a className="site-menu-link" href={EXTERNAL_LINKS.github}>
              GitHub
            </a>
          </nav>
          <div className="site-menu-actions">
            <MockLink
              className="site-button site-button--primary"
              to={GET_STARTED_SCREEN}
            >
              Get started{" "}
              <span aria-hidden="true" className="site-button-arrow">
                &#8594;
              </span>
            </MockLink>
          </div>
        </div>
      </dialog>
    </>
  );
}
