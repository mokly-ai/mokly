import { topBar } from "../library/chrome/top-bar.js";
import { optional, useDesignInstance } from "../library/composition.js";

import { useRenderedAppearance, type AppearanceChoice } from "./appearance.js";
import { useDesignNavigation } from "./design_navigation.js";
import { DESTINATIONS } from "./destinations.js";
import { tagPickerTarget } from "./navigation_states.js";
import type { ArtboardViewport } from "./shell.js";
import { designTagRecords } from "./tag_filter.js";

interface TopBarProps {
  menuPresentation?: "text" | "icon" | undefined;
  searchPlaceholder?: string | undefined;
  activeTag?: string | undefined;
  /** Overrides the depicted setting; defaults to the rendered scheme. */
  appearanceChoice?: AppearanceChoice | undefined;
  appearanceChanged?: boolean | undefined;
  searchValue?: string | undefined;
  tagPickerOpen?: boolean | undefined;
  viewport: ArtboardViewport;
  drawerOpen?: boolean;
}

/** Map this screen's navigation and query into recorded top-bar inputs. */
export function TopBar({
  activeTag,
  appearanceChoice,
  appearanceChanged,
  drawerOpen,
  menuPresentation,
  searchValue,
  searchPlaceholder,
  tagPickerOpen,
  viewport,
}: TopBarProps) {
  const navigation = useDesignNavigation();
  const rendered = useRenderedAppearance();
  const open = navigation.drawer?.open ?? drawerOpen;
  return (
    <topBar.Component
      moklyInstance={useDesignInstance("top-bar")}
      viewport={viewport}
      placeholder={searchPlaceholder ?? "Search catalogue…"}
      menu={open ? "close" : "open"}
      menuPresentation={menuPresentation ?? "text"}
      tags={designTagRecords(navigation.tags)}
      pickerOpen={tagPickerOpen ?? false}
      appearance={appearanceChoice ?? rendered}
      {...optional("appearanceChanged", appearanceChanged)}
      brandDestination={DESTINATIONS.home}
      menuDestination={
        navigation.drawer?.to ??
        (open ? DESTINATIONS.home : DESTINATIONS.navigation)
      }
      {...optional("query", searchValue)}
      {...optional("activeTag", activeTag)}
      {...optional("pickerDestination", tagPickerTarget(navigation.tags))}
    />
  );
}
