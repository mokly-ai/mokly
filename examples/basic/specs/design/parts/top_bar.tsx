import { CANVAS_PAGES } from "../canvas/parts/destinations.js";
import { topBar } from "../library/chrome/top-bar.js";
import { optional, useDesignInstance } from "../library/composition.js";

import { useRenderedAppearance } from "./appearance.js";
import type { ArtboardViewport } from "./artboards.js";
import { useDesignNavigation } from "./design_navigation.js";
import type { DesignDestination } from "./destinations.js";
import { tagPickerTarget } from "./navigation_states.js";
import { designTagRecords } from "./tag_filter.js";

/**
 * The brand's destination of a family whose artboards link only to each
 * other, such as the Canvas viewer.
 */
export interface TopBarLinks {
  brand: DesignDestination;
}

interface TopBarProps {
  activeTag?: string | undefined;
  /** The family's own brand destination; the Canvas home by default. */
  links?: TopBarLinks | undefined;
  searchValue?: string | undefined;
  tagPickerOpen?: boolean | undefined;
  viewport: ArtboardViewport;
}

/** Map this screen's navigation and query into recorded top-bar inputs. */
export function TopBar({
  activeTag,
  links,
  searchValue,
  tagPickerOpen,
  viewport,
}: TopBarProps) {
  const navigation = useDesignNavigation();
  const appearance = useRenderedAppearance();
  return (
    <topBar.Component
      moklyInstance={useDesignInstance("top-bar")}
      viewport={viewport}
      tags={designTagRecords(navigation.tags)}
      pickerOpen={tagPickerOpen ?? false}
      appearance={appearance}
      brandDestination={links?.brand ?? CANVAS_PAGES.home}
      {...optional("query", searchValue)}
      {...optional("activeTag", activeTag)}
      {...optional("pickerDestination", tagPickerTarget(navigation.tags))}
    />
  );
}
