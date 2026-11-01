import { MetadataChips } from "../../../../../packages/ui/src/metadata-row/metadata-row.js";
import { optional, useDesignInstance } from "../library/composition.js";
import { tagChip } from "../library/controls/tag-chip.js";

import { useDesignNavigation } from "./design_navigation.js";
import { tagTarget, type NavigationState } from "./navigation_states.js";
import { CATALOGUE_TAGS, type CatalogueTag } from "./tags.js";

/** Resolve destinations before entering a registered component boundary. */
export function designTagRecords(
  state: NavigationState["tags"],
  tags: readonly CatalogueTag[] = CATALOGUE_TAGS,
) {
  return tags.map((tag) => ({
    id: tag,
    label: tag,
    ...optional("destination", tagTarget(state, tag)),
  }));
}

export function TagChips({
  activeTag,
  tags = CATALOGUE_TAGS,
}: {
  activeTag?: string | undefined;
  tags?: readonly CatalogueTag[];
}) {
  const navigation = useDesignNavigation();
  const name = useDesignInstance("tag");
  return (
    <MetadataChips>
      {designTagRecords(navigation.tags, tags).map((tag) => (
        <tagChip.Component
          key={tag.id}
          moklyInstance={name + "-" + tag.id}
          {...tag}
          selected={tag.id === activeTag}
        />
      ))}
    </MetadataChips>
  );
}
