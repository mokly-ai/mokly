/**
 * The top bar's menu and brand, which start the bar. The brand is a control
 * of the shell, a link to an address that a static depiction gives, or a
 * picture of itself in a depiction that runs no script. The menu is only a
 * link or a picture of a static depiction: in the shell, the dock's
 * Catalogue opens the catalogue's sheet, so the bar has no menu button.
 */

import { IconSvg } from "../icons/icons.js";

import { BrandIcon } from "./brand-icon.js";

function MenuIcon() {
  return (
    <IconSvg size={16}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </IconSvg>
  );
}

/**
 * The menu of a static depiction, which opens or closes the catalogue in
 * another document. A link or a picture has no expanded state, so its name
 * says whether it opens or closes the catalogue. A bar that runs its script
 * draws no menu.
 */
export function Menu({
  drawerOpen,
  href,
  interactive,
}: {
  drawerOpen: boolean;
  href: string | undefined;
  interactive: boolean;
}) {
  const name = drawerOpen
    ? "Close catalogue navigation"
    : "Open catalogue navigation";
  if (href !== undefined)
    return (
      <a
        aria-label={name}
        className="mbk-menu mbk-reset"
        data-mokly-menu=""
        href={href}
      >
        <MenuIcon />
      </a>
    );
  if (!interactive)
    return (
      <span
        aria-label={name}
        className="mbk-menu mbk-reset"
        data-mokly-menu=""
        role="img"
      >
        <MenuIcon />
      </span>
    );
  return null;
}

/**
 * The brand, as a link or a picture: the mark, and the wordmark `mokly.`
 * unless the bar draws the mark alone. The wordmark's period is its own
 * element so that it takes the brand colour.
 */
export function Brand({
  href,
  wordmark,
}: {
  href: string | undefined;
  wordmark: boolean;
}) {
  const content = (
    <>
      <span aria-hidden="true" className="mbk-mark mbk-reset">
        <BrandIcon />
      </span>
      {wordmark ? (
        <span className="mbk-name mbk-reset">
          mokly<span className="mbk-name-dot mbk-reset">.</span>
        </span>
      ) : null}
    </>
  );
  if (href === undefined)
    return (
      <span aria-label="Mokly" className="mbk-brand mbk-reset" role="img">
        {content}
      </span>
    );
  return (
    <a aria-label="Mokly" className="mbk-brand mbk-reset" href={href}>
      {content}
    </a>
  );
}
