import fs from "node:fs/promises";
import path from "node:path";

import type { ComparisonAdditions } from "./comparison_catalogue.js";
import { repositoryRoot } from "./fixture.js";
import { write } from "./static_changes.js";

/** The JavaScript screen whose CSS Module changes between the two commits. */
export const importedCssPaths = { screen: "imported/home" } as const;

/** The PNG that the CSS Module references with `url()`. */
export const importedCssImage = path.join(
  repositoryRoot,
  "examples/imported-assets/workspace-note-signal.png",
);

/** The button colour on each side. */
export const importedCssColors = {
  Before: "rgb(10, 20, 30)",
  After: "rgb(30, 20, 10)",
} as const;

const screen = `import React from "react";
import { defineScreen } from "@mokly/mokly";
import classes from "./theme.module.css";
export default defineScreen({
  title: "Imported home",
  description: "Imported CSS comparison",
  relatedDocs: [],
  props: {},
  render: () => <main><button className={classes.auth}>Sign in</button></main>,
});
`;

/**
 * A JavaScript screen that imports a CSS Module, whose rule also loads a
 * PNG through `url()`. The second commit changes only the rule's colour.
 * The repository's dependencies are linked in and ignored by Git.
 */
export const addImportedCssSources: ComparisonAdditions = async (
  root,
  side,
) => {
  const directory = `specs/${path.dirname(importedCssPaths.screen)}`;
  await write(
    root,
    `${directory}/theme.module.css`,
    `.auth { color: ${importedCssColors[side]}; background-image: url("./mark.png"); }\n`,
  );
  if (side === "After") return;
  await fs.appendFile(path.join(root, ".gitignore"), "node_modules\n");
  await fs.symlink(
    path.join(repositoryRoot, "node_modules"),
    path.join(root, "node_modules"),
    "junction",
  );
  await write(root, `specs/${importedCssPaths.screen}.mockup.tsx`, screen);
  await fs.copyFile(importedCssImage, path.join(root, directory, "mark.png"));
};
