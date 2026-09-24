import type { ScreenVariantInput } from "@mokly/mokly";

import { DESTINATIONS } from "../../../parts/destinations.js";
import { TagScreen } from "../../../parts/tag_screen.js";

export function OnboardingPickerDesktop() {
  return (
    <TagScreen
      design={DESTINATIONS.onboardingPicker}
      tag="onboarding"
      picker
      viewport="desktop"
    />
  );
}

export function OnboardingPickerMobile() {
  return (
    <TagScreen
      design={DESTINATIONS.onboardingPicker}
      tag="onboarding"
      picker
      viewport="mobile"
    />
  );
}

export const onboardingPickerVariant = {
  colorSchemes: ["light"],
  description: "Welcome with tag:onboarding and the tag picker open.",
  desktop: <OnboardingPickerDesktop />,
  id: "design-browse-tag-onboarding-picker",
  mobile: <OnboardingPickerMobile />,
  slug: "onboarding-picker",
  title: "Onboarding tag picker",
} satisfies ScreenVariantInput;
