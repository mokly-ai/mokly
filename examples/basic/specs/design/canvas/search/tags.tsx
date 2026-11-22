import { defineScreen } from "@mokly/mokly";

import { artboardStates, type ArtboardVariant } from "../../parts/artboards.js";
import type { CatalogueTag } from "../../parts/tags.js";
import { canvasDesignMetadata } from "../parts/metadata.js";

import { TagSearchArtboard } from "./parts/artboard.js";

/** A saved state that enters one tag, with the picker closed or open. */
function filtered(
  tag: CatalogueTag,
  picker: boolean,
  title: string,
  description: string,
): ArtboardVariant {
  return {
    colorSchemes: canvasDesignMetadata.colorSchemes,
    description,
    desktop: (
      <TagSearchArtboard active={tag} picker={picker} viewport="desktop" />
    ),
    mobile: (
      <TagSearchArtboard active={tag} picker={picker} viewport="mobile" />
    ),
    slug: picker ? `${tag}-picker` : tag,
    title,
  };
}

export const canvasTagSearchScreen = defineScreen({
  ...canvasDesignMetadata,
  description:
    "Welcome with the search field's tag picker open, an empty query, and the whole catalogue: the picker lists every tag that the catalogue declares. On a phone, the picker drops as a sheet under the bar.",
  ...artboardStates(
    {
      state: "picker",
      title: "Tag picker",
      desktop: <TagSearchArtboard picker viewport="desktop" />,
      mobile: <TagSearchArtboard picker viewport="mobile" />,
    },
    [
      filtered(
        "forms",
        false,
        "Forms filter",
        "Welcome with tag:forms and the picker closed: the catalogue keeps Welcome, Details, and the Action, and Inspect's forms chip reads active.",
      ),
      filtered(
        "forms",
        true,
        "Forms tag picker",
        "The forms filter with the picker open over the catalogue that it filtered.",
      ),
      filtered(
        "onboarding",
        false,
        "Onboarding filter",
        "Welcome with tag:onboarding and the picker closed: the catalogue keeps Welcome alone.",
      ),
      filtered(
        "onboarding",
        true,
        "Onboarding tag picker",
        "The onboarding filter with the picker open.",
      ),
    ],
  ),
  slug: "tags",
  rationale:
    "Tags are a secondary way to narrow a catalogue, so they get no permanent room in the catalogue: the picker hangs off the search field. Selecting a chip writes its tag into the field as a search term, so the filter stays visible and clearable where a reader looks for one; selecting it again clears it. Rows without the tag and the folders they leave empty drop out, and every chip of the entered tag reads active, so the picker, Inspect's chips, the query, and the catalogue describe one state.",
  title: "Tag search",
});
