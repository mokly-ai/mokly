/** Populate only an empty caller-owned directory. Output stays outside authored inputs. */
import fs from "node:fs/promises";
import path from "node:path";

import { counts, largeSize, stylesheetRules } from "./dimensions.js";
import type { LargeSize, Variant } from "./dimensions.js";
import { htmlArea } from "./html.js";

export { largeSize } from "./dimensions.js";
export type { LargeSize, Variant } from "./dimensions.js";
export type LargeFixture = Awaited<ReturnType<typeof generateLargeFixture>>;
export async function generateLargeFixture(
  root: string,
  input: Partial<LargeSize>,
  variant: Variant = "html",
) {
  const size = largeSize(input);
  if (variant !== "html" && variant !== "react")
    throw new Error("variant must be html or react");
  if ((await fs.readdir(root)).length)
    throw new Error("Fixture requires an empty directory");
  const templates = import.meta.dirname;
  for (const folder of ["specs", "assets"])
    await fs.mkdir(path.join(root, folder));
  for (const file of [
    "catalogue.css",
    "tokens.css",
    "tokens-dark.css",
    "mark.svg",
  ])
    await fs.copyFile(
      path.join(templates, "assets", file),
      path.join(root, "assets", file),
    );
  for (let i = 1; i <= size.stylesheets; i++)
    await fs.writeFile(
      path.join(root, "assets", `shared-${i}.css`),
      `.scale-screen { scroll-margin-top: ${i}px; }\n`,
    );
  const config: Record<string, unknown> = {
    repoRoot: ".",
    review: { base: "main" },
    roots: [{ dir: "specs" }],
    colorSchemes: ["light", "dark"],
    stylesheets: stylesheetRules(size),
  };
  if (variant === "react") {
    config.renderer = "renderer.tsx";
    config.moduleResolution = {
      aliases: { "react-native": "react-native-web" },
      conditions: ["react-native", "import", "module", "default"],
      loaders: { ".js": "jsx" },
      mainFields: ["react-native", "module", "main"],
      resolveExtensions: [
        ".web.tsx",
        ".web.ts",
        ".web.js",
        ".tsx",
        ".ts",
        ".js",
        ".jsx",
        ".json",
      ],
    };
    await fs.mkdir(path.join(root, "src"));
    for (const file of [
      "components.tsx",
      "screens.tsx",
      "area.tsx",
      "dimensions.ts",
    ])
      await fs.copyFile(
        path.join(templates, file),
        path.join(root, "src", file),
      );
    const renderer = (
      await fs.readFile(path.join(templates, "renderer.tsx"), "utf8")
    ).replace('"../../../examples/basic/theme.js"', '"./theme.js"');
    await fs.writeFile(path.join(root, "renderer.tsx"), renderer);
    await fs.copyFile(
      path.resolve(templates, "../../../examples/basic/theme.ts"),
      path.join(root, "theme.ts"),
    );
  }
  await fs.writeFile(
    path.join(root, "mokly.config.json"),
    JSON.stringify(config, null, 2) + "\n",
  );
  await fs.writeFile(
    path.join(root, "notes.md"),
    "# Scale fixture\n\nDeterministic synthetic catalogue for startup diagnostics.\n",
  );
  await fs.writeFile(
    path.join(root, ".gitignore"),
    ".context/\nnode_modules\n.mokly-export-reservations/\nmokly-static/\n",
  );
  for (let i = 1; i <= size.areas; i++) {
    const area = `area-${i}`;
    const dir = path.join(root, "specs", area);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "handbook.md"),
      `---\ntitle: Activity handbook\n---\n# Activity handbook\n\nUse the [first screen](mock:${area}/screens/activity-group-1/screen-1#summary) to review activity.\n`,
    );
    if (variant === "html") {
      await htmlArea(root, area, size);
      continue;
    }
    const exports = ["action", "panel", "guide"].map(
      (key) => `export const ${key} = area.${key};`,
    );
    for (let n = 0; n < size.screens; n++)
      exports.push(`export const screen${n + 1} = area.screens[${n}];`);
    for (let n = 0; n < Math.ceil(size.screens / 10); n++)
      exports.push(`export const flow${n + 1} = area.flows[${n}];`);
    await fs.writeFile(
      path.join(dir, "catalogue.mockup.tsx"),
      `import { createArea } from "../../src/area.js";\nconst area = createArea(${JSON.stringify(area)}, ${size.screens}, ${size.rows});\n${exports.join("\n")}\n`,
    );
  }
  return {
    root,
    configPath: path.join(root, "mokly.config.json"),
    variant,
    size,
    ...counts(size),
  };
}
