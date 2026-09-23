import type { Viewport } from "@mokly/mokly";

import { ViewIcon } from "../../components/parts/view_icons.js";
import { DesignLink } from "../../parts/design_navigation.js";
import { BrandIcon, SearchIcon, TagIcon } from "../../parts/icons.js";
import { tagPicker } from "../controls/tag-picker.js";
import { useDesignStyle } from "../style_context.js";

import type { TopBarProps } from "./top-bar.js";

export function TopBarView({
  query,
  placeholder,
  menu,
  menuPresentation,
  tags,
  activeTag,
  pickerOpen,
  brandDestination,
  menuDestination,
  pickerDestination,
  viewport,
}: TopBarProps & { viewport: Viewport }) {
  useDesignStyle("top-bar");
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
      <div className="mbk-search">
        <SearchIcon />
        {query === undefined ? (
          placeholder
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
    </header>
  );
}
