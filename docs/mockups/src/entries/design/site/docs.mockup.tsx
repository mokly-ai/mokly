import { defineScreen } from "@mokly/mokly";

import {
  SiteDocsFirstScreen,
  SiteDocsLayersScreen,
  SiteDocsScreen,
} from "../../../screens/design/site/docs_screen";
import { SITE_METADATA } from "../../../screens/design/site/parts/metadata";

/** The named screen component that each state draws. */
const screens = {
  default: SiteDocsScreen,
  "first-screen": SiteDocsFirstScreen,
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
    properties: { state: { enum: ["default", "first-screen", "layers"] } },
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
      slug: "layers",
      title: "Documentation · Layers",
      description:
        "The mobile sub-bar's Layers control with the section tree open as a sheet over the Install guide; the scrim, the control or a link closes it. The desktop view keeps the tree in the Layers panel, so it matches the documentation page.",
      props: { state: "layers" },
    },
  ],
});
