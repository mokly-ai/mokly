import { defineScreen } from "@mokly/mokly";

import { componentDesignMetadata } from "../../../metadata.js";
import { artboards } from "../../../parts/artboards.js";
import { ComponentPage } from "../../parts/component_page.js";

export function StoryFailedDesktop() {
  return <ComponentPage state="story-failed" viewport="desktop" />;
}

export function StoryFailedMobile() {
  return <ComponentPage state="story-failed" viewport="mobile" />;
}

export function StoryFailedChangesDesktop() {
  return <ComponentPage state="story-failed-changes" viewport="desktop" />;
}

export function StoryFailedChangesMobile() {
  return <ComponentPage state="story-failed-changes" viewport="mobile" />;
}

export function StorybookLinkDesktop() {
  return <ComponentPage state="storybook-link" viewport="desktop" />;
}

export function StorybookLinkMobile() {
  return <ComponentPage state="storybook-link" viewport="mobile" />;
}

/**
 * One scenario of a Menu stories file: on this branch its Expanded story
 * renders its list through a portal, so it no longer renders, and the
 * configuration gives the URL of the published Storybook.
 */
export const storyFailedScreen = defineScreen({
  ...componentDesignMetadata,
  slug: "story-failed",
  title: "Failed story",
  colorSchemes: ["light"],
  description:
    "Menu's Expanded story renders its list through a portal, so it could not render on this branch. Each canvas holds the error document that Mokly writes in place of the failed view: the story and its failure, the !mokly tag that leaves the story out, and then the reason.",
  rationale:
    "The document loaded, so the shell around it stays as it is: the Changed badge, the comparison band in Current, and Highlight components disabled, because the document renders no registered component. The shell's own failure, This screen could not be shown, replaces the frame instead, so the two read apart. Details link the same story in the published Storybook.",
  ...artboards({
    desktop: <StoryFailedDesktop />,
    mobile: <StoryFailedMobile />,
  }),
});
export const storyFailedChangesScreen = defineScreen({
  ...componentDesignMetadata,
  slug: "story-failed-changes",
  title: "Failed story in Changes",
  colorSchemes: ["light"],
  description:
    "The same Expanded story in Changes, in Side by side. It rendered on the branch point, so Before shows its last render, with the list open, and Current shows the error document.",
  rationale:
    "The error document is the view's new content, so the variant reads as changed, with the shell's own heading and comparison details. No screen uses the Menu, so its inspector opens on Details, where the comparison facts live.",
  ...artboards({
    desktop: <StoryFailedChangesDesktop />,
    mobile: <StoryFailedChangesMobile />,
  }),
});
export const storybookLinkScreen = defineScreen({
  ...componentDesignMetadata,
  slug: "storybook-link",
  title: "Link to Storybook",
  colorSchemes: ["light"],
  description:
    "The Menu's own page, which its first story, Collapsed, renders. The configuration gives the URL of the published Storybook, so Details link the same story there, directly below its source.",
  rationale:
    "The link opens the story's own address in that Storybook, from the story's Storybook id, and each variant links its own story. Without the URL, Details show no Storybook row. The stories file declares no tags or related docs, so Details list neither.",
  ...artboards({
    desktop: <StorybookLinkDesktop />,
    mobile: <StorybookLinkMobile />,
  }),
});
