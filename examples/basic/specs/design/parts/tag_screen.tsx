import type { DesignDestination } from "./destinations.js";
import { DESTINATIONS } from "./destinations.js";
import { ExampleWorkspace } from "./example_workspace.js";
import { NavTree, type NavNode } from "./nav.js";
import { WelcomeHead } from "./screen_heads.js";
import { Shell, type ArtboardViewport } from "./shell.js";
import type { CatalogueTag } from "./tags.js";

function taggedTree(tag: CatalogueTag): readonly NavNode[] {
  const count = tag === "forms" ? 2 : 1;
  return [
    {
      key: "example",
      count,
      depth: 0,
      kind: "folder",
      label: "Example",
      open: true,
    },
    {
      key: "screens",
      count,
      depth: 1,
      kind: "folder",
      label: "Screens",
      open: true,
    },
    {
      key: "welcome",
      depth: 2,
      kind: "screen",
      label: "Welcome",
      to: DESTINATIONS.welcome,
    },
    ...(tag === "forms"
      ? [
          {
            key: "details",
            depth: 2,
            kind: "screen" as const,
            label: "Details",
            to: DESTINATIONS.details,
          },
        ]
      : []),
  ];
}

/** Shared depiction of a Welcome search state for its owning artboards. */
export function TagScreen({
  design,
  tag,
  picker = false,
  viewport,
}: {
  design: DesignDestination;
  tag?: CatalogueTag;
  picker?: boolean;
  viewport: ArtboardViewport;
}) {
  return (
    <Shell
      design={design}
      activeTag={tag}
      viewport={viewport}
      nav={
        <NavTree
          activeLabel="Welcome"
          nodes={tag ? taggedTree(tag) : undefined}
        />
      }
      searchValue={tag ? `tag:${tag}` : undefined}
      tagPickerOpen={picker}
    >
      <WelcomeHead active={viewport} />
      <ExampleWorkspace
        subject="welcome"
        viewport={viewport}
        activeTag={tag}
        open={viewport === "desktop"}
      />
    </Shell>
  );
}
