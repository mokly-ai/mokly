import type { Viewport } from "@mokly/mokly";

import { DesignLink } from "../../parts/design_navigation.js";
import { ChevronIcon } from "../../parts/icons.js";
import { NavResizeHandle } from "../../parts/nav_resize.js";

import { NavRow } from "./catalogue-navigation-row.view.js";
import { navigationSections } from "./catalogue-navigation-sections.js";
import type { CatalogueNavigationProps } from "./catalogue-navigation.js";

/**
 * Availability wording shown in place of the Changes rows. A `spinner` entry
 * names the work still running; a `detail` entry adds the secondary line.
 */
const CHANGES_MESSAGES = {
  pending: { title: "Checking for changes…", spinner: "Checking for changes" },
  preparing: {
    title: "Preparing comparison",
    spinner: "Preparing comparison",
    detail: "This takes a moment. You can keep browsing All while it finishes.",
  },
  unavailable: { title: "Changes are unavailable. You can still browse All." },
} as const;

type ChangesMessage = (typeof CHANGES_MESSAGES)[keyof typeof CHANGES_MESSAGES];

function ChangesStatusBody({ message }: { message: ChangesMessage }) {
  return (
    <div className="mbk-nav-status" role="status">
      {"spinner" in message ? (
        <span className="mbk-nav-spinner" aria-hidden="true" />
      ) : null}
      {"detail" in message ? (
        <span className="mbk-nav-status-text">
          <span className="mbk-nav-status-title">{message.title}</span>
          <span className="mbk-nav-status-detail">{message.detail}</span>
        </span>
      ) : (
        message.title
      )}
    </div>
  );
}

export function CatalogueNavigationView({
  activeDestination,
  activeLabel,
  changedCount,
  changedOnly,
  changesStatus = "ready",
  showChanges = true,
  rows,
  presentation,
  allDestination,
  changesDestination,
  viewport,
}: CatalogueNavigationProps & { viewport: Viewport }) {
  const status =
    changesStatus === "ready" ? undefined : CHANGES_MESSAGES[changesStatus];
  const sections = navigationSections(rows);
  const body = (
    <>
      <div className="mbk-nav-head">
        Catalogue<span>Collapse all</span>
      </div>
      {showChanges ? (
        <div
          className="mbk-nav-filter"
          role="group"
          aria-label="Catalogue filter"
        >
          <DesignLink to={changedOnly ? allDestination : undefined}>
            <span
              className={
                changedOnly ? "mbk-nav-filter-opt" : "mbk-nav-filter-opt active"
              }
            >
              All
            </span>
          </DesignLink>
          <DesignLink to={changedOnly ? undefined : changesDestination}>
            <span
              className={
                changedOnly ? "mbk-nav-filter-opt active" : "mbk-nav-filter-opt"
              }
            >
              Changes
              <span className="mbk-nav-filter-count">
                {status && "spinner" in status ? (
                  <span
                    className="mbk-nav-spinner"
                    aria-label={status.spinner}
                    role="status"
                  />
                ) : status ? (
                  "—"
                ) : (
                  changedCount
                )}
              </span>
            </span>
          </DesignLink>
        </div>
      ) : null}
      <div className="mbk-nav-scroll">
        {changedOnly && status ? (
          <ChangesStatusBody message={status} />
        ) : (
          sections.map((section) => (
            <details
              className="mbk-nav-section"
              data-nav-section={section.id}
              key={section.id}
              open
            >
              <summary className="mbk-nav-section-head">
                <span className="mbk-nav-section-chevron" aria-hidden="true">
                  <ChevronIcon />
                </span>
                {section.label}
              </summary>
              {section.rows.map((node) => (
                <NavRow
                  key={node.key}
                  activeDestination={activeDestination}
                  activeLabel={activeLabel}
                  node={node}
                />
              ))}
            </details>
          ))
        )}
      </div>
    </>
  );
  const drawer = presentation === "drawer" || viewport === "mobile";
  return (
    <nav
      className={drawer ? "mbk-nav mbk-drawer" : "mbk-nav"}
      aria-label="Catalogue"
    >
      {body}
      {drawer ? null : <NavResizeHandle />}
    </nav>
  );
}
