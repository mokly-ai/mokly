/**
 * The parts that the Browse, Review and Edit frames share: the copy of a
 * module, its kicker, heading and body, and the labelled frame that holds
 * its depiction on the canvas.
 */

import type { ReactNode } from "react";

import { classNames } from "../parts/class-names.js";
import { SiteFrameLabel } from "../parts/frame-label.js";
import { SiteKicker } from "../parts/labels.js";

/** A module's copy: the numbered kicker, the heading and the body. */
export function ModuleText({
  children,
  className,
  headingId,
  index,
  kicker,
  title,
}: {
  children: ReactNode;
  className?: string | undefined;
  headingId: string;
  index: string;
  kicker: string;
  title: string;
}) {
  return (
    <div className={classNames("site-module-text", className)}>
      <SiteKicker className="site-module-eyebrow" index={index}>
        {kicker}
      </SiteKicker>
      <h3 id={headingId}>{title}</h3>
      <p className="site-module-body">{children}</p>
    </div>
  );
}

/** A labelled frame on the canvas, such as `01 Browse`. */
export function ModuleFrame({
  children,
  className,
  name,
}: {
  children: ReactNode;
  className?: string | undefined;
  name: string;
}) {
  return (
    <div className={classNames("site-module-detail", className)}>
      <SiteFrameLabel name={name} />
      {children}
    </div>
  );
}
