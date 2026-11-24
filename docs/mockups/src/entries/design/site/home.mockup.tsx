import { defineScreen } from "@mokly/mokly";

import {
  SiteHomeMenuScreen,
  SiteHomeScreen,
  SiteHomeZoomedInScreen,
  SiteHomeZoomedOutScreen,
} from "../../../screens/design/site/home_screen";
import { SITE_METADATA } from "../../../screens/design/site/parts/metadata";

/** The named screen component that each state draws. */
const screens = {
  default: SiteHomeScreen,
  menu: SiteHomeMenuScreen,
  "zoomed-out": SiteHomeZoomedOutScreen,
  "zoomed-in": SiteHomeZoomedInScreen,
};

export default defineScreen({
  ...SITE_METADATA,
  description:
    "The Canvas home: `Design in code.` as a selected text layer, the spread of the depicted acme/storefront app, the Specs panel of page sections, the Browse, Review and Edit frames and the open foundation. The demo app is drawn as static components (decision 2). Each demo draws its finished state, as reduced motion shows it on the site: the compare rests in Swipe at 50 percent, Review waits for Approve, and Edit shows Claude on the changed PriceCard with Publish ready. No frame is selected, because the hero is the section in view. On the home the status bar's zoom pill is a control: a group named Zoom with Zoom out, the zoom and Zoom in. The rest of the status bar stays a depiction.",
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: { enum: ["default", "menu", "zoomed-out", "zoomed-in"] },
    },
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
    {
      slug: "zoomed-out",
      title: "Home · Zoomed out",
      description:
        "The home at 41 percent, four presses of Zoom out from 100 percent. The hero, the workspace and the footer frame keep their layout of 100 percent at the window's width, and the zoom only scales them, so nothing reflows. The scaled content sits at the centre of the window's width, and the page starts at its top and ends where the scaled content ends. The tool bar, the status bar and the Specs panel keep their size. The panel keeps its place at the window's start, 120 pixels below the workspace's top. The site scales with a transform. This static drawing scales with CSS zoom, which Chromium draws the same way. The pill shows 41%.",
      props: { state: "zoomed-out" },
    },
    {
      slug: "zoomed-in",
      title: "Home · Zoomed in",
      description:
        "The home at 200 percent, the end of the zoom range, which the fourth press of Zoom in from 100 percent reaches. The hero, the workspace and the footer frame are twice as large, each in the layout that it has at 100 percent at the window's width. The page scrolls sideways, and the tool bar, the status bar and the Specs panel keep their size and their place in the window. The drawing opens at the page's start, as a static document does. Zoom in is at its end of the range: it takes aria-disabled, so it keeps focus, and its glyph is muted with no hover fill. The pill shows 200%.",
      props: { state: "zoomed-in" },
    },
  ],
});
