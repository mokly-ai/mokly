import fs from "node:fs/promises";
import path from "node:path";

import { ordinaryPreviewFixtureSource } from "./ordinary_preview_source.js";
export type ExampleProfile =
  "design-library" | "ordinary-preview" | "static-example" | "shared-export";
export async function configureFocusedExample(
  root: string,
  profile: ExampleProfile,
  keepRecipe = false,
): Promise<void> {
  const configPath = path.join(root, "examples/basic/mokly.config.ts");
  let config = await fs.readFile(configPath, "utf8");
  if (!keepRecipe)
    config = config.replace(/ {4}baselineBuild: \[[\s\S]*? {4}\],\n/, "");
  if (profile === "static-example" || profile === "shared-export") {
    if (profile === "static-example")
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
  if (profile === "design-library" || profile === "shared-export") {
    const roots = [
      ...(profile === "shared-export"
        ? [
            { dir: "specs/example", path: "example" },
            { dir: "src/components", path: "example/components" },
          ]
        : []),
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
