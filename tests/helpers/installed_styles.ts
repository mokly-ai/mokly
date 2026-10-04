import fs from "node:fs/promises";
import path from "node:path";

import { createFixture, validEntrySource } from "./fixture.js";

/** A physically installed package that imports its own accepted stylesheets. */
export async function installedStylesFixture(
  request: "package-name" | "relative" | "repository" = "package-name",
) {
  const fixture = await createFixture(installedStyleEntry(request), {
    extraConfig: 'interactive: "serve",',
  });
  const directory = path.join(fixture.root, "node_modules/installed-style");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, "package.json"),
    JSON.stringify({
      name: "installed-style",
      version: "1.0.0",
      type: "module",
      exports: {
        ".": "./index.js",
        "./card.module.css": "./card.module.css",
        "./plain.css": "./plain.css",
      },
    }),
  );
  await fs.writeFile(
    path.join(directory, "index.js"),
    installedStyleModule(request === "relative" ? "./" : "installed-style/"),
  );
  await fs.writeFile(path.join(directory, "card.module.css"), moduleCss);
  await fs.writeFile(path.join(directory, "plain.css"), plainCss);
  return { ...fixture, directory };
}

/** Entry requests either the package JavaScript or its stylesheets directly. */
function installedStyleEntry(
  request: "package-name" | "relative" | "repository",
): string {
  const imports =
    request === "repository"
      ? 'import styles, { card } from "installed-style/card.module.css"; import "installed-style/plain.css";'
      : 'import styles, { card } from "installed-style";';
  return `${imports}\n${validEntrySource({ body: "<span className={styles.card} data-module={card}>Installed styles</span>" })}`;
}

/** Keep package code fixed while changing only one stylesheet. */
export function installedStyleModule(prefix: string): string {
  return `export { default, card } from "${prefix}card.module.css"; import "${prefix}plain.css";`;
}

export const moduleCss = ".card { color: rebeccapurple; }\n";
export const plainCss = "main { padding: 10px; }\n";
