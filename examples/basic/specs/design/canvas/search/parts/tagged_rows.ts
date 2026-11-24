import type { CatalogueNavigationProps } from "../../../library/chrome/catalogue-navigation.js";
import { COMPONENT_NAVIGATION } from "../../../parts/component_nav_data.js";
import { SUBJECTS } from "../../../parts/subjects.js";
import type { CatalogueTag } from "../../../parts/tags.js";
import { COMPONENT_IDENTITIES } from "../../parts/component_identity.js";
import { CANVAS_ALL_ROWS } from "../../parts/nav_rows.js";

type NavigationRows = CatalogueNavigationProps["rows"];

/**
 * The tags of each depicted entry that declares any, by its row's key: the
 * tags of Welcome and Details, and the tags that the example's component
 * definitions declare. A variant takes its parent's tags.
 */
const ROW_TAGS: Readonly<Record<string, readonly CatalogueTag[]>> = {
  welcome: SUBJECTS.welcome.tags,
  details: SUBJECTS.details.tags,
  [COMPONENT_NAVIGATION.action.id]: COMPONENT_IDENTITIES.action.tags,
  [COMPONENT_NAVIGATION.toolbar.id]: COMPONENT_IDENTITIES.toolbar.tags,
};

/**
 * The canonical catalogue that `tag:<tag>` filters, as the search rule
 * keeps it: each entry that declares the tag, its variants, which inherit
 * it, and the folders that hold them. A folder left empty drops out, and a
 * retained folder stays open. The rows keep their Canvas destinations.
 */
export function taggedRows(tag: CatalogueTag): NavigationRows {
  let parentTags: readonly CatalogueTag[] = [];
  const matches = CANVAS_ALL_ROWS.map((row) => {
    if (row.kind === "folder") return false;
    if (row.kind !== "variant") parentTags = ROW_TAGS[row.key] ?? [];
    return parentTags.includes(tag);
  });
  const holdsMatch = (index: number, depth: number) => {
    const after = CANVAS_ALL_ROWS.slice(index + 1);
    const end = after.findIndex((row) => row.depth <= depth);
    return matches
      .slice(index + 1, index + 1 + (end < 0 ? after.length : end))
      .includes(true);
  };
  return CANVAS_ALL_ROWS.filter((row, index) =>
    row.kind === "folder" ? holdsMatch(index, row.depth) : matches[index],
  );
}
