/**
 * A browser entry of `tag_chip_selection.spec.ts`: the tag chip as a selected
 * link, button, and picture, and as a resting button and picture.
 */

import { renderToStaticMarkup } from "react-dom/server";

import { TagChip } from "@mokly/ui/tag-chip";

document.body.innerHTML = renderToStaticMarkup(
  <>
    <TagChip href="#forms" selected tag="forms" />
    <TagChip selected tag="onboarding" />
    <TagChip interactive={false} selected tag="documents" />
    <TagChip selected={false} tag="guides" />
    <TagChip interactive={false} selected={false} tag="drafts" />
  </>,
);
document.body.dataset["rendered"] = "";
