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

/** One crumb: a link to a folder's page, a folder reveal, or plain text. */
function Crumb<Item extends ScreenHeaderCrumb>({
  item,
  onRevealFolder,
}: {
  item: Item;
  onRevealFolder: ((crumb: Item) => void) | undefined;
}) {
  const { folder, href, label } = item;
  if (href !== undefined)
    return (
      <a className="mbk-crumb-link" href={href}>
        {label}
      </a>
    );
  if (folder === undefined) return label;
  return (
    <button
      className="mbk-crumb-link"
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
  onCopyPath,
  onRevealFolder,
  path,
  status,
}: {
  action?: ReactNode;
  crumbs: readonly Item[];
  heading: string;
  /** Receives the path when the reader presses the path chip. */
  onCopyPath?: ((path: string) => void) | undefined;
  /** Receives the folder crumb that the reader chooses. */
  onRevealFolder?: ((crumb: Item) => void) | undefined;
  /** The entry's path, which the path chip shows. */
  path?: string | undefined;
  status?: ReactNode;
}) {
  return (
    <div className="mbk-screen-head">
      <div className="mbk-screen-head-copy">
        <p aria-label="Catalogue location" className="mbk-crumbs">
          {crumbs.map((item, index) => (
            <span key={`${item.label}-${index}`}>
              {index > 0 ? <span className="sep">›</span> : null}
              <Crumb item={item} onRevealFolder={onRevealFolder} />
            </span>
          ))}
        </p>
        <div className="mbk-title-row">
          <h2>{heading}</h2>
          {path ? (
            <button
              aria-label={`Copy path ${path}`}
              className="mbk-pathchip"
              data-copy-path={path}
              onClick={() => onCopyPath?.(path)}
              type="button"
            >
              {path}
            </button>
          ) : null}
          {status}
        </div>
      </div>
      {action}
    </div>
  );
}
