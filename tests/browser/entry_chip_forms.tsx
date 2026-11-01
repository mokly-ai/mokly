/**
 * A browser entry of `entry_chip_edge.spec.ts`: a use-case and a screen entry
 * chip, as Details link them, and a resting tag chip link.
 */

import { renderToStaticMarkup } from "react-dom/server";

import { EntryChip, MetadataChips } from "@mokly/ui/metadata-row";
import { TagChip } from "@mokly/ui/tag-chip";

document.body.innerHTML = renderToStaticMarkup(
  <MetadataChips>
    <EntryChip href="#tour" kind="use-case" title="Example tour" />
    <EntryChip href="#welcome" kind="screen" title="Welcome" />
    <TagChip href="#forms" selected={false} tag="forms" />
  </MetadataChips>,
);
document.body.dataset["rendered"] = "";
