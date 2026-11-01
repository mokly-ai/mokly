/**
 * The header above a catalogue view: the breadcrumb trail, the title, the
 * path chip that copies the entry's path, a status, and the view's controls.
 */

import type { ReactNode } from "react";

/**
 * One breadcrumb. A crumb with an address links to a folder's page. A crumb
 * with a folder is a button that reveals that folder's row in the catalogue
 * navigation. Any other crumb is text.
 */
export interface ScreenHeaderCrumb {
  /** The address of the folder's own page. */
  href?: string;
  /** The folder that the crumb reveals; its path names the button. */
  folder?: { path: string };
  label: string;
}

/**
 * One crumb: a link to a folder's page, a folder reveal, or plain text. A
 * header that is not interactive draws a folder reveal as text.
 */
function Crumb<Item extends ScreenHeaderCrumb>({
  interactive,
  item,
  onRevealFolder,
}: {
  interactive: boolean;
  item: Item;
  onRevealFolder: ((crumb: Item) => void) | undefined;
}) {
  const { folder, href, label } = item;
  if (href !== undefined)
    return (
      <a className="mbk-crumb-link mbk-reset" href={href}>
        {label}
      </a>
    );
  if (folder === undefined || !interactive) return label;
  return (
    <button
      className="mbk-crumb-link mbk-reset"
      data-crumb-folder={folder.path}
      onClick={() => onRevealFolder?.(item)}
      type="button"
    >
      {label}
    </button>
  );
}

/**
 * The header of one view. `status` follows the path chip in the title row,
 * and `action` holds the view's controls at the end of the header. The crumbs
 * may carry more fields than a crumb needs; a folder crumb's own record
 * reaches `onRevealFolder`.
 */
export function ScreenHeader<Item extends ScreenHeaderCrumb>({
  action,
  crumbs,
  heading,
  interactive = true,
  onCopyPath,
  onRevealFolder,
  path,
  status,
}: {
  action?: ReactNode;
  crumbs: readonly Item[];
  heading: string;
  /**
   * Whether the path chip and a folder crumb are buttons, as they are by
   * default. A static depiction that runs no script sets `false`, which
   * draws the path chip as a picture of itself and a folder crumb as text.
   */
  interactive?: boolean;
  /** Receives the path when the reader presses the path chip. */
  onCopyPath?: ((path: string) => void) | undefined;
  /** Receives the folder crumb that the reader chooses. */
  onRevealFolder?: ((crumb: Item) => void) | undefined;
  /** The entry's path, which the path chip shows. */
  path?: string | undefined;
  status?: ReactNode;
}) {
  return (
    <div className="mbk-screen-head mbk-reset">
      <div className="mbk-screen-head-copy mbk-reset">
        <p aria-label="Catalogue location" className="mbk-crumbs mbk-reset">
          {crumbs.map((item, index) => (
            <span className="mbk-reset" key={`${item.label}-${index}`}>
              {index > 0 ? <span className="sep mbk-reset">›</span> : null}
              <Crumb
                interactive={interactive}
                item={item}
                onRevealFolder={onRevealFolder}
              />
            </span>
          ))}
        </p>
        <div className="mbk-title-row mbk-reset">
          <h2 className="mbk-reset">{heading}</h2>
          {path ? (
            interactive ? (
              <button
                aria-label={`Copy path ${path}`}
                className="mbk-pathchip mbk-reset"
                data-copy-path={path}
                onClick={() => onCopyPath?.(path)}
                type="button"
              >
                {path}
              </button>
            ) : (
              <span className="mbk-pathchip mbk-reset" data-copy-path={path}>
                {path}
              </span>
            )
          ) : null}
          {status}
        </div>
      </div>
      {action}
    </div>
  );
}
