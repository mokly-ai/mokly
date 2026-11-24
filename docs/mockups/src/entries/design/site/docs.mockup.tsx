import { defineScreen } from "@mokly/mokly";

import {
  SiteDocsFirstScreen,
  SiteDocsFirstScreenDesktop,
  SiteDocsLayersScreen,
  SiteDocsScreen,
} from "../../../screens/design/site/docs_screen";
import { SITE_METADATA } from "../../../screens/design/site/parts/metadata";

/** The named screen component that each state draws. */
const screens = {
  default: SiteDocsScreen,
  "first-screen": SiteDocsFirstScreen,
  "first-screen-desktop": SiteDocsFirstScreenDesktop,
  layers: SiteDocsLayersScreen,
};

export default defineScreen({
  ...SITE_METADATA,
  description:
    "The Install guide as a selected page frame on the canvas, between the Layers panel, with search, the CLI version and every section, and the Inspect panel, with the page's properties, Edit on GitHub and On this page. Below the breakpoint a sub-bar names the section and the page and opens search, and On this page sits under the lead as a disclosure.",
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: {
        enum: ["default", "first-screen", "first-screen-desktop", "layers"],
      },
    },
  } as const,
  props: { state: "default" },
  render: ({ state }, context) => {
    const Screen = screens[state];
    return <Screen viewport={context.viewport} />;
  },
  tags: ["site", "canvas"],
  title: "Documentation",
  useCasePaths: ["design/site/tour"],
  variants: [
    {
      slug: "first-screen",
      title: "Documentation · Your first screen",
      description:
        "The Your first screen guide. Its first code block is an HTML sample fence: the source beside the screen it renders, under the viewport and saved-state controls, with a wire from the heading's line to the heading. The drawing selects Mobile and Welcome and dims the line that the mobile view does not render. Below the breakpoint the fence stacks the code, the controls and the frame, without the wire.",
      props: { state: "first-screen" },
    },
    {
      slug: "first-screen-desktop",
      title: "Documentation · Your first screen · Desktop",
      description:
        "The Your first screen guide with its HTML sample fence on the Desktop view. The drawing selects Desktop and Welcome: the 1280 × 800 view, scaled down to fit the band, sits in a browser window under its label and over its size tag, and the line that the desktop view does not render is dimmed. Beside the code the frame keeps the Mobile view's column, so the code does not move, and a wire joins the heading's line to the heading. Below the breakpoint the fence stacks the code, the controls and a wider frame, without the wire.",
      props: { state: "first-screen-desktop" },
    },
    {
      slug: "layers",
      title: "Documentation · Layers",
      description:
        "The mobile sub-bar's Layers control with the section tree open as a sheet over the Install guide; the scrim, the control or a link closes it. The desktop view keeps the tree in the Layers panel, so it matches the documentation page.",
      props: { state: "layers" },
    },
  ],
});
