import type { ScreenVariantInput } from "@mokly/mokly";

import { DESTINATIONS } from "../../../parts/destinations.js";
import { TagScreen } from "../../../parts/tag_screen.js";

export function TagPickerDesktop() {
  return (
    <TagScreen design={DESTINATIONS.tagPicker} picker viewport="desktop" />
  );
}

export function TagPickerMobile() {
  return <TagScreen design={DESTINATIONS.tagPicker} picker viewport="mobile" />;
}

export const tagPickerVariant = {
  colorSchemes: ["light"],
  description: "Welcome with an empty query and the tag picker open.",
  desktop: <TagPickerDesktop />,
  id: "design-browse-tag-picker",
  mobile: <TagPickerMobile />,
  slug: "picker",
  title: "Tag picker",
} satisfies ScreenVariantInput;
