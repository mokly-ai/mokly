import type { Viewport } from "@mokly/mokly";

import { ViewIcon } from "../../components/parts/view_icons.js";
import { DesignLink } from "../../parts/design_navigation.js";
import { BrandIcon, SearchIcon, TagIcon } from "../../parts/icons.js";
import { tagPicker } from "../controls/tag-picker.js";
import { useDesignStyle } from "../style_context.js";

import { appearanceSelector } from "./appearance-selector.js";
import type { TopBarProps } from "./top-bar.js";

/**
 * Watched Serve's delayed update progress. It takes its room from the search
 * field's flexible allotment, so the brand, menu and Appearance never move.
 */
function UpdateProgress() {
  return (
    <span className="mbk-progress">
      <span className="mbk-progress-spinner" aria-hidden="true" />
      Updating…
    </span>
  );
}

export function TopBarView({
  query,
  placeholder,
  menu,
  menuPresentation,
  tags,
  activeTag,
  appearance,
  appearanceChanged,
  pickerOpen,
  updating,
  brandDestination,
  menuDestination,
  pickerDestination,
  viewport,
}: TopBarProps & {
  appearance: NonNullable<TopBarProps["appearance"]>;
  viewport: Viewport;
}) {
  useDesignStyle("top-bar");
  const search = (
    <div className="mbk-search">
      <SearchIcon />
      {query === undefined ? (
        <span className="mbk-search-placeholder">{placeholder}</span>
      ) : (
        <span className="mbk-search-value">{query}</span>
      )}
      {tags.length ? (
        <DesignLink to={pickerDestination}>
          <span
            className="mbk-search-tag"
            aria-label={pickerOpen ? "Close tag picker" : "Filter by tag"}
          >
            <TagIcon size={13} />
          </span>
        </DesignLink>
      ) : null}
      {pickerOpen ? (
        <tagPicker.Component
          tags={tags}
          {...(activeTag === undefined ? {} : { activeTag })}
        />
      ) : null}
    </div>
  );
  return (
    <header className="mbk-topbar">
      {viewport === "mobile" && menu !== "none" ? (
        <DesignLink to={menuDestination}>
          <span
            className="mbk-menu-btn"
            aria-label={
              menu === "close"
                ? "Close catalogue navigation"
                : "Open catalogue navigation"
            }
          >
            {menuPresentation === "icon" && menu === "open" ? (
              <ViewIcon kind="menu" />
            ) : menu === "close" ? (
              "×"
            ) : (
              "☰"
            )}
          </span>
        </DesignLink>
      ) : null}
      <DesignLink to={brandDestination}>
        <span className="mbk-brand" aria-label="Mokly">
          <span className="mbk-mark" aria-hidden="true">
            <BrandIcon />
          </span>
          {viewport === "mobile" ? null : (
            <span className="mbk-name">mokly.</span>
          )}
        </span>
      </DesignLink>
      {updating ? (
        <div className="mbk-search-slot">
          {search}
          <UpdateProgress />
        </div>
      ) : (
        search
      )}
      <appearanceSelector.Component
        value={appearance}
        {...(appearanceChanged === undefined
          ? {}
          : { otherSchemeChanged: appearanceChanged })}
        compact={viewport === "mobile"}
      />
    </header>
  );
}
