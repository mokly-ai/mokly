import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { generatedBytes } from "../../dist/build/generated_file.js";
import { writeCompilation } from "../../dist/build/transaction.js";

import { componentGit } from "./component_review_fixture.js";
import {
  moveCatalogueSources,
  onboardingMarkdown,
  type MoveCatalogueOptions,
} from "./move_catalogue_sources.js";
import { pathFixture } from "./path_fixture.js";

/** A real compiled directory move with a folder README, document, page and screen variant. */
export async function movedCatalogueFixture(
  t: { after: (cleanup: () => Promise<void>) => void },
  options: MoveCatalogueOptions = {},
) {
  const sources = moveCatalogueSources(options);
  const fixture = await pathFixture(
    sources,
    `{mockupsDir:"mockups",roots:[{dir:"specs"}],generatedOutput:"committed",colorSchemes:["light","dark"],review:{sharedImpact:["mockups/mokly-generated/**"]}${options.styles === "configured" ? ',stylesheets:[{match:"**/*.html",stylesheets:["theme.css"]}]' : ""}}`,
  );
  const cleanups: (() => Promise<void>)[] = [];
  t.after(async () => {
    for (const cleanup of cleanups) await cleanup();
    await fixture.remove();
  });
  await fs.mkdir(path.join(fixture.root, "mockups"), { recursive: true });
  const before = await fixture.compile();
  await writeCompilation(before, await fixture.config());
  if (options.history) {
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Mokly Test");
    git("config", "user.email", "mokly@example.invalid");
    git("add", "-A");
    git("commit", "-qm", "test: move baseline");
  }
  const destination = options.destination ?? "new";
  await fs.mkdir(path.dirname(path.join(fixture.root, "specs", destination)), {
    recursive: true,
  });
  await fs.rename(
    path.join(fixture.root, "specs/old"),
    path.join(fixture.root, "specs", destination),
  );
  if (options.declared) {
    const file = path.join(
      fixture.root,
      "specs",
      destination,
      "screen.mockup.tsx",
    );
    await fs.writeFile(
      file,
      (await fs.readFile(file, "utf8")).replace(
        "movedFrom:'prior-screen'",
        "movedFrom:'old/screen'",
      ),
    );
  }
  if (options.unrelatedDocuments) {
    await fs.unlink(path.join(fixture.root, "specs", destination, "guide.md"));
    await fixture.write(
      `specs/${destination}/onboarding.md`,
      onboardingMarkdown,
    );
  }
  if (options.edited)
    await fixture.write(
      `specs/${destination}/guide.md`,
      "# Guide\n\n## Start\n\nRead the updated guide.",
    );
  if (options.resourceChanged || options.sharedResource) {
    const image = await fs.readFile(
      path.join(fixture.root, "specs", destination, "diagram.svg"),
      "utf8",
    );
    await fixture.write(
      `specs/${options.sharedResource ? "old" : destination}/diagram.svg`,
      image.replace('r="8"', 'r="7"'),
    );
  }
  const config = await fixture.config();
  const after = await fixture.compile();
  await writeCompilation(after, config);
  const routes = [
    ...new Set([...before.outputs.keys(), ...after.outputs.keys()]),
  ];
  const changedPaths = routes
    .filter((route) => {
      const left = before.outputs.get(route);
      const right = after.outputs.get(route);
      return (
        left === undefined ||
        right === undefined ||
        !Buffer.from(generatedBytes(left)).equals(
          Buffer.from(generatedBytes(right)),
        )
      );
    })
    .map((route) => `mockups/${route}`)
    .sort();
  return {
    ...fixture,
    config,
    before,
    after,
    changedPaths,
    git: componentGit(before, changedPaths, new Map(Object.entries(sources))),
    beforeRemove: (cleanup: () => Promise<void>) => {
      cleanups.push(cleanup);
    },
  };
}
