/**
 * The mobile header's menu: the control at the trailing edge of the header
 * row and the panel it opens. The site opens the panel as a modal dialog
 * that slides in from the right edge over a dimmed page. The open state draws
 * the same panel in place; a scrim depicts the dimmed page because a static
 * document has no top layer. Above the breakpoint the header row lists the
 * same destinations and the control is not drawn.
 */

import { MockLink } from "@mokly/mokly";

import { CloseGlyph, MenuGlyph } from "./glyphs.js";
import {
  EXTERNAL_LINKS,
  GET_STARTED_SCREEN,
  SITE_SCREENS,
  currentPage,
  type SiteScreen,
} from "./links.js";

/** The site screens the menu lists, in the header's reading order. */
const PAGES: ReadonlyArray<readonly [SiteScreen, string]> = [
  [SITE_SCREENS.docs, "Docs"],
  [SITE_SCREENS.changelog, "Changelog"],
];

/** The control that opens the menu, drawn on the mobile header row only. */
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
      <MenuGlyph />
    </button>
  );
}

/** The open menu: the site's destinations, then Get started. */
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
              <CloseGlyph />
            </button>
          </div>
          <nav aria-label="Main" className="site-menu-nav">
            {PAGES.map(([screen, label]) => (
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
              Get started <span aria-hidden="true">&#8594;</span>
            </MockLink>
          </div>
        </div>
      </dialog>
    </>
  );
}
