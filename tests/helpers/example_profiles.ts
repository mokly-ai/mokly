import fs from "node:fs/promises";
import path from "node:path";

export type ExampleProfile =
  "design-library" | "ordinary-preview" | "static-example" | "shared-export";

export async function configureFocusedExample(
  root: string,
  profile: ExampleProfile,
  keepRecipe = false,
): Promise<void> {
  const configPath = path.join(root, "examples/basic/mokly.config.ts");
  let config = await fs.readFile(configPath, "utf8");
  const entries =
    profile === "static-example" || profile === "shared-export"
      ? [
          "examples/basic/entries/catalogue.mockup.tsx",
          "examples/basic/src/components/**/*.mockup.tsx",
          ...(profile === "shared-export"
            ? ["examples/basic/entries/browser-design-fixture.mockup.tsx"]
            : []),
        ]
      : [
          profile === "design-library"
            ? "examples/basic/entries/browser-design-fixture.mockup.tsx"
            : "examples/basic/entries/browser-preview-fixture.mockup.tsx",
        ];
  config = config.replace(
    / {2}entries: \[[\s\S]*?\n {2}\],\n {2}mockupsDir:/,
    `  entries: ${JSON.stringify(entries)},\n  mockupsDir:`,
  );
  if (!keepRecipe)
    config = config.replace(/ {4}baselineBuild: \[[\s\S]*? {4}\],\n/, "");
  await fs.writeFile(configPath, config);
  if (profile === "static-example" || profile === "shared-export") {
    const entryPath = path.join(
      root,
      "examples/basic/entries/catalogue.mockup.tsx",
    );
    const source = await fs.readFile(entryPath, "utf8");
    await fs.writeFile(
      entryPath,
      source.replace(
        `      <p>\n        <MockLink to="design-browse-home">See the Mokly shell design</MockLink>\n      </p>\n`,
        "",
      ),
    );
    if (profile === "static-example") return;
  }
  const [name, source] =
    profile === "design-library" || profile === "shared-export"
      ? ["browser-design-fixture.mockup.tsx", designLibraryFixtureSource]
      : ["browser-preview-fixture.mockup.tsx", ordinaryPreviewFixtureSource];
  await fs.writeFile(path.join(root, "examples/basic/entries", name), source);
}

const designLibraryFixtureSource = `import React from "react";
import { defineScreen } from "@mokly/mokly";
import { appearanceSelector } from "./design/library/chrome/appearance-selector.js";
import { topBar } from "./design/library/chrome/top-bar.js";
import { tagChip } from "./design/library/controls/tag-chip.js";
import { tagPicker } from "./design/library/controls/tag-picker.js";

const metadata = { dependencies: [], relatedDocs: [] };
const destinations = [
  ["design-browse-home", "Home"],
  ["design-browse-screen", "Welcome"],
  ["design-browse-navigation", "Navigation"],
  ["design-browse-tag-forms", "Forms"],
  ["design-browse-tag-onboarding", "Onboarding"],
] as const;
const tags = [
  { id: "forms", label: "forms", destination: "design-browse-tag-forms" },
  { id: "onboarding", label: "onboarding", destination: "design-browse-tag-onboarding" },
];
const picker = (viewport: "mobile" | "desktop") => (
  <main>
    <topBar.Component
      activeTag="forms"
      appearance="light"
      brandDestination="design-browse-home"
      menu="open"
      menuDestination="design-browse-navigation"
      menuPresentation="text"
      pickerDestination="design-browse-tag-picker"
      pickerOpen
      placeholder="Search catalogue…"
      query="tag:forms"
      tags={tags}
      viewport={viewport}
    />
  </main>
);

export const mockups = [
  appearanceSelector.entries,
  topBar.entries,
  tagChip.entries,
  tagPicker.entries,
  ...destinations.map(([id, title]) =>
    defineScreen({ ...metadata, description: title, desktop: <main>{title}</main>, id, mobile: <main>{title}</main>, title }),
  ),
  defineScreen({
    ...metadata,
    description: "Tag picker",
    desktop: picker("desktop"),
    id: "design-browse-tag-picker",
    mobile: picker("mobile"),
    title: "Tag picker",
  }),
];
`;

const ordinaryPreviewFixtureSource = `import React from "react";
import { definePage, defineRoot } from "@mokly/mokly";
import { mockups as actionEntries } from "../src/components/action/action.mockup.js";
import { mockups as toolbarEntries } from "../src/components/toolbar/toolbar.mockup.js";
import { mockups as exampleEntries } from "./catalogue.mockup.js";
import { detailsScreen } from "./design/browse/views/details-screen.js";
import { browseViewScreens } from "./design/browse_screens.js";
import { mockups as libraryEntries } from "./design/library/library.mockup.js";
import { pageScreens } from "./design/page_screens.js";
import { DESTINATIONS } from "./design/parts/destinations.js";
import { COMPONENT_PAGES, CONTROLS_PAGES, INSPECTION_PAGES } from "./design/components/parts/destinations.js";

const designEntries = defineRoot({
  children: [...browseViewScreens, detailsScreen, ...pageScreens.slice(0, 3)],
  navPath: ["Design"],
});
const existing = new Set([
  ...exampleEntries.map((entry) => entry.id),
  ...designEntries.map((entry) => entry.id),
]);
const fallbackEntries = [...new Set([
  ...Object.values(DESTINATIONS),
  ...Object.values(COMPONENT_PAGES),
  ...Object.values(CONTROLS_PAGES),
  ...Object.values(INSPECTION_PAGES),
])]
  .filter((id) => !existing.has(id))
  .map((id) =>
    definePage({
      dependencies: [],
      description: "Navigation-only fixture destination",
      id,
      relatedDocs: [],
      render: () => "<!doctype html><html><body><main>" + id + "</main></body></html>",
      title: id,
    }),
  );

export const mockups = [
  exampleEntries,
  actionEntries,
  toolbarEntries,
  libraryEntries,
  designEntries,
  fallbackEntries,
];
`;
