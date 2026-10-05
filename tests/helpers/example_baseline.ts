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
import { ordinaryPreviewFixtureSource } from "./ordinary_preview_source.js";

const execute = promisify(execFile);

/** Commit source and tooling so normal composition can rebuild the isolated baseline. */
export async function createExampleBaseline(root: string) {
  await copyExampleRepository(root);
  const config = await loadConfig(root, "examples/basic/mokly.config.ts");
  await initializeRepository(root);
  return config;
}

/** Build a current v8 committed baseline with current code for browser fixtures. */
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
  config = config
    .replace(
      "export default defineConfig({",
      'export default defineConfig({\n  generatedOutput: "committed",',
    )
    .replace(/ {4}baselineBuild: \[[\s\S]*? {4}\],\n/, "");
  if (profile === "static-example") {
    config = config.replace(
      / {2}roots: \[[\s\S]*?\n {2}\],/,
      `  roots: [{dir:"specs/example",path:"example"},{dir:"src/components",path:"example/components"}],`,
    );
    const entryPath = path.join(root, "examples/basic/specs/catalogue.tsx");
    const source = await fs.readFile(entryPath, "utf8");
    const focused = source.replace(
      / {6}<p>\n {8}<MockLink to="design\/browse\/views\/home">[\s\S]*?<\/MockLink>\n {6}<\/p>\n/,
      "",
    );
    if (source === focused)
      throw new Error("Static example fixture did not remove its design link");
    await fs.writeFile(entryPath, focused);
  }
  if (profile === "design-library") {
    const roots = [
      {
        dir: "specs/design/library/chrome",
        path: "design/library/chrome",
        files: ["appearance-selector.mockup.ts", "top-bar.mockup.ts"],
      },
      {
        dir: "specs/design/library/controls",
        path: "design/library/controls",
        files: ["tag-chip.mockup.ts", "tag-picker.mockup.ts"],
      },
      { dir: "browser-fixtures" },
    ];
    config = config.replace(
      / {2}roots: \[[\s\S]*?\n {2}\],/,
      `  roots: ${JSON.stringify(roots)},`,
    );
    const directory = path.join(root, "examples/basic/browser-fixtures");
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(
      path.join(directory, "catalogue.mockup.tsx"),
      designLibraryFixtureSource,
    );
  }
  if (profile === "ordinary-preview") {
    const roots = [
      { dir: "specs/example", path: "example" },
      { dir: "src/components", path: "example/components" },
      { dir: "specs/design/library", path: "design/library" },
      { dir: "specs/design/browse/views", path: "design/browse/views" },
      { dir: "specs/design/browse/pages", path: "design/browse/pages" },
      { dir: "browser-fixtures" },
    ];
    config = config.replace(
      / {2}roots: \[[\s\S]*?\n {2}\],/,
      `  roots: ${JSON.stringify(roots)},`,
    );
    await fs.rm(
      path.join(
        root,
        "examples/basic/specs/design/browse/pages/previous-version",
      ),
      { recursive: true },
    );
    const directory = path.join(root, "examples/basic/browser-fixtures");
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(
      path.join(directory, "destinations.mockup.tsx"),
      ordinaryPreviewFixtureSource,
    );
  }
  await fs.writeFile(configPath, config);
}

const designLibraryFixtureSource = `import React from "react";
import { defineScreen } from "@mokly/mokly";
import { topBar } from "../specs/design/library/chrome/top-bar.js";

const metadata = { dependencies: [], relatedDocs: [] };
const destinations = [
  ["design/browse/views/home", "Home"],
  ["design/browse/views/screen", "Welcome"],
  ["design/browse/states/navigation", "Navigation"],
  ["design/browse/views/screen/tag-forms", "Forms"],
  ["design/browse/views/screen/tag-onboarding", "Onboarding"],
] as const;
const tags = [
  { id: "forms", label: "forms", destination: "design/browse/views/screen/tag-forms" },
  { id: "onboarding", label: "onboarding", destination: "design/browse/views/screen/tag-onboarding" },
];
const picker = (viewport: "mobile" | "desktop") => (
  <main>
    <topBar.Component
      activeTag="forms"
      appearance="light"
      brandDestination="design/browse/views/home"
      menu="open"
      menuDestination="design/browse/states/navigation"
      menuPresentation="text"
      pickerDestination="design/browse/views/screen/tag-picker"
      pickerOpen
      placeholder="Search catalogue…"
      query="tag:forms"
      tags={tags}
      viewport={viewport}
    />
  </main>
);

export const mockups = [
  ...destinations.map(([path, title]) =>
    defineScreen({ ...metadata, description: title, desktop: <main>{title}</main>, path, slug:"index", mobile: <main>{title}</main>, title }),
  ),
  defineScreen({
    ...metadata,
    description: "Tag picker",
    desktop: picker("desktop"),
    path: "design/browse/views/screen/tag-picker",
    mobile: picker("mobile"),
    title: "Tag picker",
  }),
];
`;
