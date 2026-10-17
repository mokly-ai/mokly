import fs from "node:fs/promises";
import path from "node:path";

import { git, screen, write } from "./static_changes.js";
import { publicationFixture } from "./static_publication.js";

export const historicalBinary = Buffer.from([0, 255, 128, 13, 10, 1]);
export const currentBinary = Buffer.from([0, 254, 129, 13, 10, 2]);

export async function comparisonPublication() {
  const root = await publicationFixture();
  const config = "tools/mokly.config.json";
  await fs.mkdir(path.join(root, "tools"));
  await fs.rename(path.join(root, "specs"), path.join(root, "tools/specs"));
  await write(
    root,
    config,
    JSON.stringify({
      repoRoot: "..",
      review: { base: "configured-base" },
      stylesheets: [{ match: "**", stylesheets: ["theme.css"] }],
    }),
  );
  await write(
    root,
    "tools/theme.css",
    '@import "./styles/child.css"; .hero{color:red}',
  );
  await write(
    root,
    "tools/styles/child.css",
    '.hero{background:url("./asset.png")}',
  );
  await fs.writeFile(
    path.join(root, "tools/styles/asset.png"),
    historicalBinary,
  );
  await write(
    root,
    "tools/specs/home.screen.html",
    screen('<h1 class="hero">Before</h1>'),
  );
  await write(
    root,
    "tools/specs/retired.screen.html",
    screen("<h1>Retired</h1>"),
  );
  await git(root, "add", "-A");
  await git(root, "commit", "-qm", "historical publication");
  const base = await git(root, "rev-parse", "HEAD");
  await git(root, "branch", "configured-base");
  await write(
    root,
    "tools/specs/home.screen.html",
    screen('<h1 class="hero">After</h1>'),
  );
  await write(
    root,
    "tools/theme.css",
    '@import "./styles/child.css"; .hero{color:blue}',
  );
  await fs.writeFile(path.join(root, "tools/styles/asset.png"), currentBinary);
  await fs.rm(path.join(root, "tools/specs/retired.screen.html"));
  await git(root, "add", "-A");
  await git(root, "commit", "-qm", "current publication");
  const head = await git(root, "rev-parse", "HEAD");
  const tip = await git(
    root,
    "commit-tree",
    `${base}^{tree}`,
    "-p",
    base,
    "-m",
    "advanced base ref",
  );
  await git(root, "branch", "requested-base", tip);
  return { root, config, base, head, tip };
}
