import fs from "node:fs/promises";
import path from "node:path";

import type { Compilation } from "../../dist/build/compile.js";

import { ordinaryPreviewFixtureSource } from "./ordinary_preview_source.js";

const libraryRoot = { dir: "specs/design/library", path: "design/library" };
const roots = [
  {
    dir: "specs/example",
    path: "example",
    files: [
      "getting-started.mockup.ts",
      "tour.mockup.ts",
      "screens/*.mockup.ts",
    ],
  },
  { dir: "src/components", path: "example/components" },
  libraryRoot,
  {
    dir: "specs/design/browse/views",
    path: "design/browse/views",
    files: ["index.mockup.ts"],
  },
  {
    dir: "specs/design/browse/pages",
    path: "design/browse/pages",
    files: ["index.mockup.ts"],
  },
  { dir: "browser-fixtures" },
];

/** Retain opened screens and the registrations needed to render their real nodes. */
export async function configureOrdinaryPreview(
  root: string,
  config: string,
): Promise<string> {
  const example = path.join(root, "examples/basic");
  const write = (file: string, source: string) =>
    fs.writeFile(path.join(example, file), source);
  await fs.rm(
    path.join(example, "specs/design/browse/pages/previous-version"),
    { recursive: true },
  );
  await write(
    "specs/example/screens/welcome.mockup.ts",
    'import { welcome } from "../../catalogue.js"; export default welcome[0];\n',
  );
  await write(
    "specs/design/browse/views/index.mockup.ts",
    `import { browseViewScreens } from "../../browse_screens.js";
export { detailsScreen } from "./details-screen.js";
const opened = new Set(["home", "screen", "tag-picker", "tag-onboarding", "tag-onboarding-picker"]);
export const mockups = browseViewScreens.filter((entry) => entry.slug !== "use-case").map((entry) => {
  if (!opened.has(entry.slug)) {
    entry.mobile = entry.desktop = "Navigation destination";
    entry.description = "Navigation-only fixture destination";
  }
  return entry;
});\n`,
  );
  await write(
    "specs/design/browse/pages/index.mockup.ts",
    `import { pageScreens } from "../../page_screens.js";
export const mockups = pageScreens.filter((entry) => ["view", "details"].includes(entry.slug));\n`,
  );
  for (const directory of ["specs/design/library", "src/components"]) {
    const full = path.join(example, directory);
    for (const entry of await fs.readdir(full, {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entry.isFile() || !/\.mockup\.tsx?$/u.test(entry.name)) continue;
      const file = path.join(entry.parentPath, entry.name);
      const source = await fs.readFile(file, "utf8");
      const registration =
        /export \{ (\w+) as default \} from "([^"]+)"/u.exec(source) ??
        /import \{ (\w+) \} from "([^"]+)"/u.exec(source);
      if (!registration)
        throw new Error(`No component registration in ${file}`);
      await fs.writeFile(
        file,
        `import { ${registration[1]} } from "${registration[2]}"; export const mockups = ${registration[1]}.entries.slice(0, 2);\n`,
      );
    }
  }
  await fs.mkdir(path.join(example, "browser-fixtures"), { recursive: true });
  await write(
    "browser-fixtures/destinations.mockup.tsx",
    ordinaryPreviewFixtureSource,
  );
  await write(
    "browser-fixtures/renderer.tsx",
    `import type { RenderInput } from "@mokly/mokly";
import render from "../renderer.js";
export default function ordinaryRenderer(input: RenderInput) {
  return input.entry.kind === "component"
    ? "<!doctype html><html><body><main>Navigation destination</main></body></html>"
    : render(input);
}\n`,
  );
  return config
    .replace(
      / {2}roots: \[[\s\S]*?\n {2}\],/,
      `  roots: ${JSON.stringify(roots)},`,
    )
    .replace(
      'renderer: "renderer.tsx"',
      'renderer: "browser-fixtures/renderer.tsx"',
    );
}

/** Select stand-ins and component parents from actual rendered links and usage. */
export async function focusOrdinaryPreview(
  root: string,
  compilation: Compilation,
): Promise<void> {
  const links = new Set<string>();
  for (const content of compilation.outputs.values()) {
    if (typeof content !== "string") continue;
    for (const match of content.matchAll(/data-mokly-link="([^"]+)"/gu))
      links.add(match[1]!);
  }
  const usedComponents = new Set(
    compilation.manifest.entries.flatMap((entry) =>
      entry.kind !== "component" && "componentViews" in entry
        ? entry.componentViews.flatMap((view) =>
            view.instances.map((instance) => instance.componentId),
          )
        : [],
    ),
  );
  const files = [...usedComponents]
    .filter((name) => name.startsWith("design/library/"))
    .map((name) => `${name.slice("design/library/".length)}.mockup.ts`)
    .sort();
  const example = path.join(root, "examples/basic");
  const configPath = path.join(example, "mokly.config.ts");
  const config = await fs.readFile(configPath, "utf8");
  await fs.writeFile(
    configPath,
    config.replace(
      JSON.stringify(libraryRoot),
      JSON.stringify({ ...libraryRoot, files }),
    ),
  );
  await fs.writeFile(
    path.join(example, "browser-fixtures/destinations.mockup.tsx"),
    ordinaryPreviewFixtureSource.replace(
      ".filter((path) => !existing.has(path))",
      `.filter((path) => !existing.has(path) && new Set(${JSON.stringify([...links].sort())}).has(path))`,
    ),
  );
}
