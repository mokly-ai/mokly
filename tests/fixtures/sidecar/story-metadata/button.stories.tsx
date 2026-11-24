import type { Meta, StoryObj } from "@storybook/react";

function Button() {
  return <button>Metadata</button>;
}

export default {
  title: "Controls/Metadata",
  component: Button,
  tags: [
    "!mokly",
    "meta-tag",
    "autodocs",
    "play-fn",
    "test-fn",
    "manifest",
    "attached-mdx",
    "unattached-mdx",
  ],
  parameters: { docs: { description: { component: "Meta description" } } },
} satisfies Meta<typeof Button>;

export const HiddenDev: StoryObj<typeof Button> = { tags: ["mokly"] };
export const HiddenMokly: StoryObj<typeof Button> = { tags: ["dev"] };
export const FirstIncluded: StoryObj<typeof Button> = {
  tags: [
    "dev",
    "mokly",
    "first-tag",
    "!meta-tag",
    "Invalid",
    "two words",
    "under_score",
    "-start",
    "end-",
    "two--hyphens",
  ],
  parameters: {
    docs: {
      description: {
        component: "Included component description",
        story: "Hidden story description",
      },
    },
  },
};
export const InheritedTags: StoryObj<typeof Button> = {
  tags: ["dev", "mokly"],
  parameters: {
    docs: { description: { story: "Another hidden description" } },
  },
};
export const EmptyTags: StoryObj<typeof Button> = {
  tags: ["dev", "mokly", "!preview-tag", "!meta-tag"],
};
