import { useId } from "react";

import { mockLink, type Viewport } from "@mokly/mokly";

import { TopBar } from "../../../../../../packages/ui/src/top-bar/top-bar.js";
import { DesignLink } from "../../parts/design_navigation.js";
import type { DesignDestination } from "../../parts/destinations.js";
import { TagIcon } from "../../parts/icons.js";
import { tagPicker } from "../controls/tag-picker.js";

import { appearanceSelector } from "./appearance-selector.js";
import type { TopBarProps } from "./top-bar.js";

/** A static artboard's address for a design destination, or none. */
function address(to: DesignDestination | undefined): string | undefined {
  return to === undefined ? undefined : mockLink(to);
}

/**
 * The search field's tag toggle and the registered picker it opens. They sit
 * in the shipped bar's picker slot until the controls slice adopts the
 * shipped tag picker.
 */
function SearchTags({
  activeTag,
  pickerDestination,
  pickerOpen,
  tags,
}: Pick<
  TopBarProps,
  "activeTag" | "pickerDestination" | "pickerOpen" | "tags"
>) {
  return (
    <>
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
    </>
  );
}

/**
 * The shipped top bar. A static artboard runs no script, so its brand and
 * menu link to their artboards, a control without one is a picture, and the
 * compact search, which needs a script, is left out. Its frame carries the
 * flags that this component's stylesheet draws: the compact bar of a mobile
 * render at every width, and a bar without a menu.
 */
export function TopBarView({
  query,
  menu,
  tags,
  activeTag,
  appearance,
  appearanceChanged,
  pickerOpen,
  brandDestination,
  menuDestination,
  pickerDestination,
  viewport,
}: TopBarProps & {
  appearance: NonNullable<TopBarProps["appearance"]>;
  viewport: Viewport;
}) {
  const id = useId();
  const compact = viewport === "mobile";
  return (
    <div
      className="mbk-topbar-frame"
      data-compact={compact ? "" : undefined}
      data-menu={menu === "none" ? "none" : undefined}
    >
      <TopBar
        brandHref={address(brandDestination)}
        drawerOpen={menu === "close"}
        end={
          <appearanceSelector.Component
            value={appearance}
            {...(appearanceChanged === undefined
              ? {}
              : { otherSchemeChanged: appearanceChanged })}
            compact={compact}
          />
        }
        interactive={false}
        menuHref={menu === "none" ? undefined : address(menuDestination)}
        navigationId={`${id}navigation`}
        query={query}
        searchId={`${id}search`}
        tagPicker={
          <SearchTags
            {...(activeTag === undefined ? {} : { activeTag })}
            {...(pickerDestination === undefined ? {} : { pickerDestination })}
            pickerOpen={pickerOpen}
            tags={tags}
          />
        }
      />
    </div>
  );
}
