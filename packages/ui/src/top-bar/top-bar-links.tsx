/**
 * The top bar's menu and brand. Each is a control of the shell, a link to an
 * address that a static depiction gives, or a picture of itself in a
 * depiction that runs no script.
 */

import { BrandIcon, IconSvg } from "../icons/icons.js";

function MenuIcon() {
  return (
    <IconSvg size={16}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </IconSvg>
  );
}

/**
 * The menu that opens the catalogue drawer. The button reports the drawer
 * state that it asks for. A link or a picture has no expanded state, so its
 * name says whether it opens or closes the drawer.
 */
export function Menu({
  drawerOpen,
  href,
  interactive,
  navigationId,
  onDrawer,
}: {
  drawerOpen: boolean;
  href: string | undefined;
  interactive: boolean;
  navigationId: string;
  onDrawer: ((open: boolean) => void) | undefined;
}) {
  const name = drawerOpen
    ? "Close catalogue navigation"
    : "Open catalogue navigation";
  if (href !== undefined)
    return (
      <a aria-label={name} className="mbk-menu" data-mokly-menu="" href={href}>
        <MenuIcon />
      </a>
    );
  if (!interactive)
    return (
      <span
        aria-label={name}
        className="mbk-menu"
        data-mokly-menu=""
        role="img"
      >
        <MenuIcon />
      </span>
    );
  return (
    <button
      aria-controls={navigationId}
      aria-expanded={drawerOpen}
      aria-label="Open catalogue navigation"
      className="mbk-menu"
      data-mokly-menu=""
      onClick={() => onDrawer?.(!drawerOpen)}
      type="button"
    >
      <MenuIcon />
    </button>
  );
}

/** The brand: the mark and the wordmark, as a link or a picture. */
export function Brand({ href }: { href: string | undefined }) {
  const content = (
    <>
      <span aria-hidden="true" className="mbk-mark">
        <BrandIcon />
      </span>
      <span className="mbk-name">mokly.</span>
    </>
  );
  if (href === undefined)
    return (
      <span aria-label="Mokly" className="mbk-brand" role="img">
        {content}
      </span>
    );
  return (
    <a aria-label="Mokly" className="mbk-brand" href={href}>
      {content}
    </a>
  );
}
