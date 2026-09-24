/** Deterministic scalable consumer generation for tests and local performance investigation. */
import fs from "node:fs/promises";
import path from "node:path";

export interface LargeSize {
  areas: number;
  screens: number;
  rows: number;
  stylesheets: number;
  stylesheetShare: number;
}

export function largeSize(input: Partial<LargeSize>): LargeSize {
  const size = {
    areas: 30,
    screens: 40,
    rows: 12,
    stylesheets: 4,
    stylesheetShare: 0.5,
    ...input,
  };
  for (const name of ["areas", "screens", "rows"] as const) {
    const value = size[name];
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new Error(`${name} must be a positive integer`);
  }
  if (size.screens < 2)
    throw new Error("screens must be at least two per area");
  if (!Number.isSafeInteger(size.stylesheets) || size.stylesheets < 0)
    throw new Error("stylesheets must be a non-negative integer");
  if (
    !Number.isFinite(size.stylesheetShare) ||
    size.stylesheetShare < 0 ||
    size.stylesheetShare > 1
  )
    throw new Error("stylesheetShare must be between 0 and 1");
  return size;
}

/** Populate only an empty caller-owned directory; never overwrite a previous fixture. */
export async function generateLargeFixture(
  root: string,
  input: Partial<LargeSize>,
  generatedOutput: "committed" | "derived" = "committed",
) {
  const size = largeSize(input);
  if ((await fs.readdir(root)).length)
    throw new Error("Fixture requires an empty directory");
  const templates = import.meta.dirname;
  const entries = path.join(root, "entries");
  const assets = path.join(root, "mockups/assets");
  await fs.mkdir(entries);
  await fs.mkdir(assets, { recursive: true });
  for (const file of ["components.tsx", "screens.tsx", "area.tsx"])
    await fs.copyFile(path.join(templates, file), path.join(entries, file));
  const renderer = await fs.readFile(
    path.join(templates, "renderer.tsx"),
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "renderer.tsx"),
    renderer.replace('"../../../examples/basic/theme.js"', '"./theme.js"'),
  );
  await fs.copyFile(
    path.resolve(templates, "../../../examples/basic/theme.ts"),
    path.join(root, "theme.ts"),
  );
  for (const file of ["catalogue.css", "tokens.css", "mark.svg"])
    await fs.copyFile(
      path.join(templates, "assets", file),
      path.join(assets, file),
    );
  const sharedStylesheets = Array.from(
    { length: size.stylesheets },
    (_, index) => `assets/shared-${index + 1}.css`,
  );
  for (const [index, stylesheet] of sharedStylesheets.entries())
    await fs.writeFile(
      path.join(root, "mockups", stylesheet),
      `.scale-screen { scroll-margin-top: ${index + 1}px; }\n`,
    );
  const linkedScreens = Math.ceil(size.screens * size.stylesheetShare);
  const stylesheets = [
    ...(sharedStylesheets.length && linkedScreens
      ? [
          {
            match: `area-*/screens/activity-@(${Array.from({ length: linkedScreens }, (_, index) => index + 1).join("|")}).html`,
            stylesheets: ["assets/catalogue.css", ...sharedStylesheets],
          },
        ]
      : []),
    { match: "**/*.html", stylesheets: ["assets/catalogue.css"] },
  ];
  const areas = Array.from(
    { length: size.areas },
    (_, index) => `area-${index + 1}`,
  );
  await fs.writeFile(
    path.join(root, "notes.md"),
    "# Scale fixture\n\nDeterministic synthetic catalogue for startup diagnostics.\n",
  );
  await fs.writeFile(
    path.join(root, ".gitignore"),
    ".review/\n.mokly-cache/\nnode_modules/\n" +
      (generatedOutput === "derived"
        ? "mockups/**/*.html\nmockups/mokly-manifest.json\n"
        : ""),
  );
  await fs.writeFile(
    path.join(root, "mokly.config.ts"),
    `import { defineConfig } from "@mokly/mokly";
export default defineConfig({
  generatedOutput: ${JSON.stringify(generatedOutput)},
  repoRoot: ".", entriesDir: "entries", mockupsDir: "mockups", renderer: "renderer.tsx",
  colorSchemes: ["light", "dark"],
  moduleResolution: { aliases: { "react-native": "react-native-web" }, conditions: ["react-native", "import", "module", "default"], loaders: { ".js": "jsx" }, mainFields: ["react-native", "module", "main"], resolveExtensions: [".web.tsx", ".web.ts", ".web.js", ".tsx", ".ts", ".js", ".jsx", ".json"] },
  stylesheets: ${JSON.stringify(stylesheets)},
  review: { base: "main", outDir: ".review"${
    generatedOutput === "derived"
      ? ', baselineBuild: [["npm", "ci"], ["npx", "--no-install", "mokly", "build", "--config", "mokly.config.ts"]]'
      : ""
  } }
});\n`,
  );
  await fs.writeFile(
    path.join(entries, "catalogue.mockup.tsx"),
    `import { defineCollection } from "@mokly/mokly";
export const mockups = [defineCollection({ id: "large", title: "Large catalogue", description: "Synthetic product areas", relatedDocs: ["notes.md"], childIds: ${JSON.stringify(areas)} })];\n`,
  );
  for (const id of areas) {
    const directory = path.join(entries, id);
    await fs.mkdir(directory);
    await fs.writeFile(
      path.join(directory, "catalogue.mockup.tsx"),
      `import { createArea } from "../area.js";
export const mockups = createArea(${JSON.stringify(id)}, ${size.screens}, ${size.rows});\n`,
    );
  }
  const flows = Math.ceil(size.screens / 10);
  return {
    root,
    generatedOutput,
    configPath: path.join(root, "mokly.config.ts"),
    size,
    routes: size.areas * (size.screens + 2 + flows + 1),
    documents: size.areas * (size.screens * 4 + 2 * 3 * 4 + 1),
  };
}
