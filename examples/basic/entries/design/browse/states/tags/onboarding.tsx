import type { ScreenVariantInput } from "@mokly/mokly";

import { DESTINATIONS } from "../../../parts/destinations.js";
import { TagScreen } from "../../../parts/tag_screen.js";

export function OnboardingFilterDesktop() {
  return (
    <TagScreen
      design={DESTINATIONS.onboarding}
      tag="onboarding"
      viewport="desktop"
    />
  );
}

export function OnboardingFilterMobile() {
  return (
    <TagScreen
      design={DESTINATIONS.onboarding}
      tag="onboarding"
      viewport="mobile"
    />
  );
}

export const onboardingFilterVariant = {
  colorSchemes: ["light"],
  description: "Welcome with tag:onboarding and the tag picker closed.",
  desktop: <OnboardingFilterDesktop />,
  id: "design-browse-tag-onboarding",
  mobile: <OnboardingFilterMobile />,
  slug: "onboarding",
  title: "Onboarding filter",
} satisfies ScreenVariantInput;
