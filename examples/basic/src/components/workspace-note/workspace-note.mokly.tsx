import { defineComponent } from "@mokly/mokly";

import { WorkspaceNote } from "./workspace-note.js";

const directory = "examples/basic/src/components/workspace-note";

/** The same imported-style example is available as a saved component view. */
export const workspaceNote = defineComponent({
  slug: "index",
  title: "Workspace note",
  description:
    "A getting-started note styled with the workspace's product styles.",
  dependencies: [directory],
  ownedDependencies: [directory],
  relatedDocs: ["examples/basic/README.md"],
  propSchema: { kind: "object", properties: {} },
  render: () => <WorkspaceNote />,
  variants: [{ slug: "default", title: "Default", props: {} }],
});
