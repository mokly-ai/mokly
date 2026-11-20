import { topBar } from "../library/chrome/top-bar.js";
import { optional, useDesignInstance } from "../library/composition.js";

import { useRenderedAppearance, type AppearanceChoice } from "./appearance.js";
import { useDesignNavigation } from "./design_navigation.js";
import { DESTINATIONS, type DesignDestination } from "./destinations.js";
import { tagPickerTarget } from "./navigation_states.js";
import type { ArtboardViewport } from "./shell.js";
import { designTagRecords } from "./tag_filter.js";

/**
 * The brand's and the menu's destinations of a family whose artboards link
 * only to each other, such as the Canvas viewer. A menu without one is a
 * picture of itself.
 */
export interface TopBarLinks {
  brand: DesignDestination;
  menu?: DesignDestination | undefined;
}

interface TopBarProps {
  activeTag?: string | undefined;
  /** Overrides the depicted setting; defaults to the rendered scheme. */
  appearanceChoice?: AppearanceChoice | undefined;
  appearanceChanged?: boolean | undefined;
  /** The family's own brand and menu destinations; Browse's when absent. */
  links?: TopBarLinks | undefined;
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
  links,
  searchValue,
  tagPickerOpen,
  viewport,
}: TopBarProps) {
  const navigation = useDesignNavigation();
  const rendered = useRenderedAppearance();
  const open = navigation.drawer?.open ?? drawerOpen;
  const menuDestination =
    links === undefined
      ? (navigation.drawer?.to ??
        (open ? DESTINATIONS.home : DESTINATIONS.navigation))
      : links.menu;
  return (
    <topBar.Component
      moklyInstance={useDesignInstance("top-bar")}
      viewport={viewport}
      menu={open ? "close" : "open"}
      tags={designTagRecords(navigation.tags)}
      pickerOpen={tagPickerOpen ?? false}
      appearance={appearanceChoice ?? rendered}
      {...optional("appearanceChanged", appearanceChanged)}
      brandDestination={links?.brand ?? DESTINATIONS.home}
      {...optional("menuDestination", menuDestination)}
      {...optional("query", searchValue)}
      {...optional("activeTag", activeTag)}
      {...optional("pickerDestination", tagPickerTarget(navigation.tags))}
    />
  );
}
