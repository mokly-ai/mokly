/**
 * A document page as a frame on the canvas: a white sheet with its source
 * file as the frame label, selected with corner handles, the way the design
 * file shows the open page. The legal pages and the documentation compose
 * it.
 */

import type { ReactNode } from "react";

import { classNames } from "./class-names.js";
import { SiteFrameLabel } from "./frame-label.js";
import { SiteSelection } from "./selection.js";

/**
 * The page frame. `file` is the page's source path, such as
 * `legal/terms.md`: its folder is muted and its file name stands out.
 * `size` adds a size tag under the frame. The area sets the frame's width
 * and the sheet's padding through `className` and its own rules for
 * `.site-page-sheet`.
 */
export function SitePageFrame({
  children,
  className,
  file,
  size,
}: {
  children: ReactNode;
  className?: string | undefined;
  file: string;
  size?: string | undefined;
}) {
  const slash = file.lastIndexOf("/") + 1;
  return (
    <div className={classNames("site-page-frame", className)}>
      <SiteFrameLabel
        icon="file"
        name={
          <>
            {file.slice(0, slash)}
            <b>{file.slice(slash)}</b>
          </>
        }
        selected
      />
      <div className="site-page-sheet">{children}</div>
      <SiteSelection handles="corners" size={size} soft />
    </div>
  );
}
