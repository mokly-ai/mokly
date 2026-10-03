import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { prepareReviewRepository } from "../../dist/review/prepare.js";
import { committedReviewRepository } from "../../dist/review/repository.js";

import { createFixture, removeFixture, validEntrySource } from "./fixture.js";

/** A Git branch point whose generated CSS is committed or reproducibly derived. */
export async function importedChangesFixture(
  context: TestContext,
  mode: "committed" | "derived",
  kind: "plain" | "module" | "asset" | "new",
) {
  const usesModule = kind === "module";
  const source = validEntrySource({
    body: usesModule
      ? "<button className={classes.auth}>Sign in</button>"
      : '<button className="auth">Sign in</button>',
  }).replace(
    ">Detail</main>",
    usesModule
      ? "><span className={classes.guide}>Detail</span></main>"
      : '><span className="guide">Detail</span></main>',
  );
  const fixture = await createFixture(source);
  context.after(() => removeFixture(fixture));
  if (kind === "asset") {
    await fs.writeFile(
      fixture.entryPath,
      (await fs.readFile(fixture.entryPath, "utf8")).replace(
        '"home", "details", "tour"',
        '"home", "details", "tour", "secondary"',
      ),
    );
    await fs.writeFile(
      path.join(fixture.entriesDir, "secondary.mockup.tsx"),
      `import React from "react";
import { defineScreen } from "@mokly/mokly";
import "./secondary.css";
export const mockups = [defineScreen({
  id: "secondary", route: "screens/secondary.html", title: "Secondary",
  description: "Independent screen", dependencies: [], relatedDocs: [],
  desktop: <main className="guide">Other</main>,
  mobile: <main className="guide">Other</main>,
})];\n`,
    );
    await fs.writeFile(
      path.join(fixture.entriesDir, "secondary.css"),
      ".guide { color: black; }",
    );
  }
  const filename = usesModule ? "theme.module.css" : "theme.css";
  const cssPath = path.join(fixture.entriesDir, filename);
  if (kind !== "new") {
    await fs.writeFile(
      cssPath,
      kind === "asset"
        ? '.auth { font-family: Test; src: url("./font.woff2"); }'
        : ".auth { color: black; } .guide { color: black; }",
    );
    await fs.appendFile(
      fixture.entryPath,
      usesModule
        ? `\nimport classes from "./${filename}";\n`
        : `\nimport "./${filename}";\n`,
    );
  }
  if (kind === "asset")
    await fs.writeFile(
      path.join(fixture.entriesDir, "font.woff2"),
      Buffer.from([0, 1, 2]),
    );
  await fs.writeFile(
    fixture.configPath,
    (await fs.readFile(fixture.configPath, "utf8"))
      .replace('"committed"', JSON.stringify(mode))
      .replace(
        'sharedImpact: ["notes.md"]',
        `sharedImpact: ["entries/**", "notes.md"]${mode === "derived" ? ', baselineBuild: [["node", "baseline.mjs"]]' : ""}`,
      ),
  );
  const config = await loadConfig(fixture.root);
  const baseline = await compileCatalogue(config);
  if (mode === "committed") await writeCompilation(baseline, config);
  else {
    await fs.writeFile(
      path.join(fixture.root, "baseline.json"),
      JSON.stringify(
        [...baseline.outputs].map(([route, value]) => [
          route,
          Buffer.from(value).toString("base64"),
        ]),
      ),
    );
    await fs.writeFile(
      path.join(fixture.root, "baseline.mjs"),
      `import fs from "node:fs/promises";
import path from "node:path";
for (const [route, encoded] of JSON.parse(await fs.readFile("baseline.json", "utf8"))) {
  const target = path.join("mockups", route);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, Buffer.from(encoded, "base64"));
}\n`,
    );
    await fs.writeFile(
      path.join(fixture.root, ".gitignore"),
      "mockups/**/*.html\nmockups/mokly-manifest.json\nmockups/mokly-generated/\n.mokly-cache/\n",
    );
  }
  const git = (...arguments_: string[]) =>
    execFileSync("git", arguments_, { cwd: fixture.root, stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Mokly Test");
  git("config", "user.email", "mokly@example.invalid");
  git("add", ".");
  git("commit", "-qm", "test: imported styles baseline");
  const repository =
    mode === "derived"
      ? await prepareReviewRepository(config, "HEAD")
      : committedReviewRepository(config);
  return { ...fixture, config, cssPath, git, repository };
}
