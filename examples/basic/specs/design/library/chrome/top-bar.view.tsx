import { useId } from "react";

import { mockLink, type Viewport } from "@mokly/mokly";

import { TopBar } from "../../../../../../packages/ui/src/top-bar/top-bar.js";
import type { DesignDestination } from "../../parts/destinations.js";
import { optional } from "../composition.js";
import { tagPicker } from "../controls/tag-picker.js";

import { appearanceSelector } from "./appearance-selector.js";
import type { TopBarProps } from "./top-bar.js";

/** A static artboard's address for a design destination, or none. */
function address(to: DesignDestination | undefined): string | undefined {
  return to === undefined ? undefined : mockLink(to);
}

/**
 * The shipped top bar, which draws no menu, as the shell's bar does. A
 * static artboard runs no script, so its brand links to its artboard, a
 * control without one is a picture, and the compact search's toggle is a
 * native button without a handler, which only a narrow embedded bar shows.
 * The search field ends with the registered tag picker.
 * The bar's frame carries the flag that this component's stylesheet draws:
 * the compact bar of a mobile render at every width.
 */
export function TopBarView({
  query,
  tags,
  activeTag,
  appearance,
  appearanceChanged,
  pickerOpen,
  brandDestination,
  pickerDestination,
  viewport,
}: TopBarProps & {
  appearance: NonNullable<TopBarProps["appearance"]>;
  viewport: Viewport;
}) {
  const id = useId();
  const compact = viewport === "mobile";
  return (
    <div className="mbk-topbar-frame" data-compact={compact ? "" : undefined}>
      <TopBar
        brandHref={address(brandDestination)}
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
        query={query}
        searchId={`${id}search`}
        tagPicker={
          <tagPicker.Component
            tags={tags}
            open={pickerOpen}
            {...optional("activeTag", activeTag)}
            {...optional("toggleDestination", pickerDestination)}
          />
        }
      />
    </div>
  );
}
