import { screen } from "@mokly/mokly";

import { DESTINATIONS } from "./parts/destinations.js";
import { TagScreen } from "./parts/tag_screen.js";

function TagFilterDesktop() {
  return (
    <TagScreen
      design={DESTINATIONS.formsPicker}
      tag="forms"
      picker
      viewport="desktop"
    />
  );
}

function TagFilterMobile() {
  return (
    <TagScreen
      design={DESTINATIONS.formsPicker}
      tag="forms"
      picker
      viewport="mobile"
    />
  );
}

/** Browse shell design screen for tag filtering through the search field. */
export const browseTagScreens = [
  screen({
    colorSchemes: ["light"],
    description:
      "The search field's tag picker open over the catalogue it has filtered.",
    desktop: <TagFilterDesktop />,
    id: "design-browse-tag-filter",
    mobile: <TagFilterMobile />,
    rationale:
      "Tags are a secondary way to narrow a catalogue, so they get no permanent room in the navigation: the picker hangs off the search field, opened by the tag control at the field's trailing edge, and its panel scrolls, which keeps a catalogue with many tags as workable as one with two. Selecting a chip writes that tag into the field as a search term, so the active filter stays visible and clearable where a reader already looks for one, and it still composes with free text and the All/Changed filter; selecting the chip for the entered term clears it again. Rows without the tag and the groups they leave empty drop out of the tree, and every chip for the entered term reads in the accent, so the picker, the inspector chips, the query, and the filtered tree describe a single state.",
    title: "Tag filter",
  }),
];
