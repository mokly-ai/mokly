/** Isolate the real example's current files from unrelated checkout and branch history. */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";

import { copyExampleSources } from "./example_sources.js";
import { repositoryRoot } from "./fixture.js";
import { replaceRequired } from "./required_replacement.js";

const execute = promisify(execFile);

/** Commit source and tooling so normal composition can rebuild the isolated baseline. */
export async function createExampleBaseline(root: string) {
  await copyExampleRepository(root);
  const config = await loadConfig(root, "examples/basic/mokly.config.ts");
  await initializeRepository(root);
  return config;
}

/** Build a focused v7 committed baseline with current code for browser fixtures. */
export async function createCommittedExampleBaseline(
  root: string,
  profile: "design-library" | "ordinary-preview" | "static-example",
) {
  await copyExampleRepository(root);
  await configureFocusedExample(root, profile);
  const config = await loadConfig(root, "examples/basic/mokly.config.ts");
  await writeCompilation(await compileCatalogue(config), config);
  await initializeRepository(root, true);
  return config;
}

async function copyExampleRepository(root: string): Promise<void> {
  await copyExampleSources(root);
  for (const name of [
    ".gitignore",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tsconfig.build.json",
    "scripts/copy-assets.mjs",
    "packages/viewer",
    "src",
  ])
    await fs.cp(path.join(repositoryRoot, name), path.join(root, name), {
      recursive: true,
      filter: (source) =>
        !source
          .split(path.sep)
          .some((part) => part === "dist" || part === "node_modules"),
    });
}

async function initializeRepository(
  root: string,
  generated = false,
): Promise<void> {
  const git = (...args: string[]) => execute("git", args, { cwd: root });
  await git("init", "-q", "-b", "main");
  await git("config", "user.name", "Mokly Test");
  await git("config", "user.email", "mokly@example.invalid");
  await git("add", ".");
  if (generated) await git("add", "-f", "examples/basic/generated");
  await git(
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-qm",
    "test: unchanged example baseline",
  );
}

async function configureFocusedExample(
  root: string,
  profile: "design-library" | "ordinary-preview" | "static-example",
): Promise<void> {
  const configPath = path.join(root, "examples/basic/mokly.config.ts");
  let config = await fs.readFile(configPath, "utf8");
  const entries =
    profile === "static-example"
      ? [
          "examples/basic/entries/catalogue.mockup.tsx",
          "examples/basic/src/components/**/*.mockup.tsx",
        ]
      : [
          profile === "design-library"
            ? "examples/basic/entries/browser-design-fixture.mockup.tsx"
            : "examples/basic/entries/browser-preview-fixture.mockup.tsx",
        ];
  config = focusedExampleConfigSource(config, entries);
  await fs.writeFile(configPath, config);
  if (profile === "static-example") {
    const entryPath = path.join(
      root,
      "examples/basic/entries/catalogue.mockup.tsx",
    );
    const source = await fs.readFile(entryPath, "utf8");
    await fs.writeFile(entryPath, staticExampleEntrySource(source));
    return;
  }
  const [name, source] =
    profile === "design-library"
      ? ["browser-design-fixture.mockup.tsx", designLibraryFixtureSource]
      : ["browser-preview-fixture.mockup.tsx", ordinaryPreviewFixtureSource];
  await fs.writeFile(path.join(root, "examples/basic/entries", name), source);
}

/** Focus the example config while requiring every expected source edit. */
export function focusedExampleConfigSource(
  source: string,
  entries: readonly string[],
): string {
  let configured = replaceRequired(
    source,
    "export default defineConfig({",
    'export default defineConfig({\n  generatedOutput: "committed",',
    "generatedOutput insertion",
  );
  configured = replaceRequired(
    configured,
    /^ {2}entries: \[[\s\S]*?^ {2}\],$/mu,
    `  entries: ${JSON.stringify(entries)},`,
    "entries array",
  );
  return replaceRequired(
    configured,
    /^ {4}baselineBuild: \[[\s\S]*?^ {4}\],\n/mu,
    "",
    "baselineBuild removal",
  );
}

/** Remove the one catalogue link excluded from the static-example fixture. */
export function staticExampleEntrySource(source: string): string {
  return replaceRequired(
    source,
    `      <p>\n        <MockLink to="design-browse-home">See the Mokly shell design</MockLink>\n      </p>\n`,
    "",
    "static-example design link",
  );
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
import { action } from "../src/components/action/action.mokly.js";
import { guestPicker } from "../src/components/guest-picker/guest-picker.mokly.js";
import { toolbar } from "../src/components/toolbar/toolbar.mokly.js";
import { workspaceNote } from "../src/components/workspace-note/workspace-note.mokly.js";
import { mockups as exampleEntries } from "./catalogue.mockup.js";
import { detailsScreen } from "./design/browse/views/details-screen.js";
import { browseViewScreens } from "./design/browse_screens.js";
import { mockups as libraryEntries } from "./design/library/library.mockup.js";
import { pageScreens } from "./design/page_screens.js";
import { DESTINATIONS } from "./design/parts/destinations.js";
import { COMPONENT_PAGES, CONTROLS_PAGES, INSPECTION_PAGES } from "./design/components/parts/destinations.js";
import { INTERACTIVE_PAGES } from "./design/interactive/parts/destinations.js";

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
  ...Object.values(INTERACTIVE_PAGES),
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
  action.entries,
  guestPicker.entries,
  toolbar.entries,
  workspaceNote.entries,
  libraryEntries,
  designEntries,
  fallbackEntries,
];
`;
