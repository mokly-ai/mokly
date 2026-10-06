import fs from "node:fs/promises";
import path from "node:path";

import type { Compilation } from "../../packages/mokly/dist/build/compile.js";
import { generatedBytes } from "../../packages/mokly/dist/build/generated_file.js";
import { writeCompilation } from "../../packages/mokly/dist/build/transaction.js";
import type { ResolvedConfig } from "../../packages/mokly/dist/config/types.js";
import type { ReadOnlyReviewRepository } from "../../packages/mokly/dist/review/repository.js";

import { componentGit } from "./component_review_fixture.js";
import {
  moveCatalogueSources,
  onboardingMarkdown,
  type MoveCatalogueOptions,
} from "./move_catalogue_sources.js";
import { assertMoveDelivery, commitMoveBaseline } from "./move_delivery.js";
import { pathFixture } from "./path_fixture.js";

type MovedCatalogueFixtureResult = {
  config: ResolvedConfig;
  before: Compilation;
  after: Compilation;
  changedPaths: string[];
  git: ReadOnlyReviewRepository;
  beforeRemove: (cleanup: () => Promise<void>) => void;
  root: string;
  write: (name: string, content: string) => Promise<void>;
  remove: () => Promise<void>;
  compile: () => Promise<Compilation>;
};

/** A real compiled directory move with a folder README, document, page and screen variant. */
export async function movedCatalogueFixture(
  t: { after: (cleanup: () => Promise<void>) => void },
  options: MoveCatalogueOptions = {},
): Promise<MovedCatalogueFixtureResult> {
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
  await commitMoveBaseline(await fixture.config(), before);
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
  await assertMoveDelivery(config, after);
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
