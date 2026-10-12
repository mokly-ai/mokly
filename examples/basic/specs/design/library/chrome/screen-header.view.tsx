import { Fragment } from "react";

import { DesignLink } from "../../parts/design_navigation.js";
import { changeStatusBadge } from "../controls/change-status.js";
import { comparisonToolbar } from "../controls/comparison-toolbar.js";

import type { ScreenHeaderProps } from "./screen-header.js";

export function ScreenHeaderView({
  title,
  crumbs,
  path,
  status,
  comparisons,
  mode,
  scrollTogether,
  accessible,
  destinations,
  actions,
}: ScreenHeaderProps) {
  return (
    <>
      <div className="mbk-screen-head">
        <div>
          <nav className="mbk-crumbs" aria-label="Catalogue location">
            {crumbs.map((crumb, index) => (
              <Fragment key={crumb.key}>
                {index > 0 ? <span className="sep">›</span> : null}
                <DesignLink to={crumb.destination}>
                  <span>{crumb.label}</span>
                </DesignLink>
              </Fragment>
            ))}
          </nav>
          <div className="mbk-title-row">
            <h2>{title}</h2>
            {path ? (
              <span aria-label={`Path ${path}`} className="mbk-pathchip">
                {path}
              </span>
            ) : null}
            {status ? <changeStatusBadge.Component status={status} /> : null}
          </div>
        </div>
        {actions}
      </div>
      {path && comparisons ? (
        <comparisonToolbar.Component
          mode={mode}
          scrollTogether={scrollTogether}
          eligible
          accessible={accessible}
          destinations={destinations}
        />
      ) : null}
    </>
  );
}
