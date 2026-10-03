import type { ScreenVariantInput } from "@mokly/mokly";

import { DESTINATIONS } from "../../../parts/destinations.js";
import { TagScreen } from "../../../parts/tag_screen.js";

export function FormsFilterDesktop() {
  return (
    <TagScreen design={DESTINATIONS.forms} tag="forms" viewport="desktop" />
  );
}

export function FormsFilterMobile() {
  return (
    <TagScreen design={DESTINATIONS.forms} tag="forms" viewport="mobile" />
  );
}

export const formsFilterVariant = {
  colorSchemes: ["light"],
  description: "Welcome with tag:forms and the tag picker closed.",
  desktop: <FormsFilterDesktop />,
  slug: "tag-forms",
  mobile: <FormsFilterMobile />,
  title: "Forms filter",
} satisfies ScreenVariantInput;
