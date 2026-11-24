import { defineScreen } from "@mokly/mokly";

import {
  SiteHomeMenuScreen,
  SiteHomeScreen,
} from "../../../screens/design/site/home_screen";
import { SITE_METADATA } from "../../../screens/design/site/parts/metadata";

/** The named screen component that each state draws. */
const screens = {
  default: SiteHomeScreen,
  menu: SiteHomeMenuScreen,
};

export default defineScreen({
  ...SITE_METADATA,
  description:
    "The Canvas home: `Design in code.` as a selected text layer, the spread of the depicted acme/storefront app, the Specs panel of page sections, the Browse, Changes, Review and Edit frames and the open foundation. The demo app is drawn as static components (decision 2). Each demo draws its finished state, as reduced motion shows it on the site: in Browse, Sam has pressed Continue on onboarding/welcome and the link line leads into the viewer, where pricing is open and current; the Changes compare rests in Swipe at 50 percent, Review waits for Approve, and Edit shows Claude on the changed PriceCard with Publish ready. No frame is selected, because the hero is the section in view.",
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["default", "menu"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, context) => {
    const Screen = screens[state];
    return <Screen viewport={context.viewport} />;
  },
  tags: ["site", "canvas"],
  title: "Home",
  useCasePaths: ["design/site/tour"],
  variants: [
    {
      slug: "menu",
      title: "Home · Menu",
      description:
        "The mobile header's menu, open over the home. Every page's mobile header opens the same menu. The desktop header lists these destinations in its row, so the desktop view matches the home.",
      props: { state: "menu" },
    },
  ],
});
