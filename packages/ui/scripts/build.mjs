/**
 * Build `@mokly/ui`: compile the components, copy each component stylesheet
 * beside its JavaScript, and write `styles.css` with the rules of every
 * component.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import {
  componentStylesheets,
  orderedStylesheets,
  packageStylesheet,
} from "./styles.mjs";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "src");
const target = path.join(root, "dist");

/** Every file below `src`, as a POSIX path relative to it. */
async function sourceFiles() {
  let entries;
  try {
    entries = await fs.readdir(source, {
      recursive: true,
      withFileTypes: true,
    });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(source, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join("/"),
    );
}

// A fresh build never ships an output that an earlier component left behind.
await fs.rm(target, { force: true, recursive: true });
await fs.mkdir(target, { recursive: true });
const files = await sourceFiles();
// tsc rejects a project without inputs, so a package without a component
// skips the compiler.
if (files.some((file) => /\.tsx?$/u.test(file)))
  execFileSync(
    process.execPath,
    [
      createRequire(import.meta.url).resolve("typescript/bin/tsc"),
      "--project",
      path.join(root, "tsconfig.build.json"),
    ],
    { stdio: "inherit" },
  );
const stylesheets = componentStylesheets(files);
for (const file of files) {
  if (
    file.endsWith(".css") &&
    file !== "styles.css" &&
    !stylesheets.some((css) => css.file === file)
  )
    process.stderr.write(
      `warning: src/${file} is not a component stylesheet, so the package leaves it out. Name it src/{name}/{name}.css.\n`,
    );
}
const imports = files.includes("styles.css")
  ? await fs.readFile(path.join(source, "styles.css"), "utf8")
  : "";
const components = [];
for (const { name, file } of orderedStylesheets(
  stylesheets,
  imports,
  (message) => process.stderr.write(message),
)) {
  const css = await fs.readFile(path.join(source, file), "utf8");
  await fs.mkdir(path.join(target, name), { recursive: true });
  await fs.writeFile(path.join(target, file), css);
  components.push({ name, css });
}
await fs.writeFile(
  path.join(target, "styles.css"),
  packageStylesheet(components),
);
