import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { compareReview } from "../../dist/review/compare.js";
import {
  NodeGitCommandRunner,
  CommittedRepository,
} from "../../dist/review/git.js";

import { changedFixture } from "./changed_fixture.js";
import { componentEntrySource } from "./component_fixture.js";
import { validEntrySource, type TestFixture } from "./fixture.js";

export async function cssAttributionFixture(
  t: TestContext,
  components: boolean,
  options: {
    body?: string;
    prepare?(fixture: TestFixture): Promise<void>;
    transformSource?(source: string): string;
  } = {},
) {
  const source = validEntrySource({
    body: options.body ?? '<button className="auth">Sign in</button>',
  }).replaceAll(">Detail</main>", '><p className="guide">Guide</p></main>');
  const library = componentEntrySource()
    .split("\n")
    .slice(2)
    .join("\n")
    .replaceAll("metadata", "componentMetadata")
    .replace("export const mockups = [", "const library = [");
  const combinedSource = components
    ? source.replace(
        "defineUseCase }",
        "defineUseCase, defineComponent, MockLink, ReviewIgnore }",
      ) +
      library +
      "\nmockups.push(...library.slice(0, 2));"
    : source;
  const fixture = await changedFixture(
    t,
    options.transformSource?.(combinedSource) ?? combinedSource,
    {
      extraConfig:
        'colorSchemes: ["light", "dark"], stylesheets: [{ match: "**/*.html", stylesheets: ["shared.css"] }],',
    },
    async (fixture) => {
      const { mockupsDir, configPath } = fixture;
      await fs.writeFile(
        configPath,
        (await fs.readFile(configPath, "utf8")).replace(
          'sharedImpact: ["notes.md"]',
          'sharedImpact: ["mockups/**"]',
        ),
      );
      await fs.writeFile(
        path.join(mockupsDir, "shared.css"),
        '.auth { color: black; } .guide { color: black; } @font-face { font-family: Fixture; src: url("font.woff2"); } .asset { background: url("image.svg"); }',
      );
      await fs.writeFile(
        path.join(mockupsDir, "font.woff2"),
        "fixture font bytes",
      );
      await fs.writeFile(
        path.join(mockupsDir, "image.svg"),
        '<svg xmlns="http://www.w3.org/2000/svg"/>',
      );
      await options.prepare?.(fixture);
    },
  );
  const config = fixture.config;
  const git = new CommittedRepository(new NodeGitCommandRunner(fixture.root));
  return {
    ...fixture,
    config,
    append: (css: string, resource = "shared.css") =>
      fs.appendFile(path.join(fixture.mockupsDir, resource), css),
    compare: async (useFastPath?: boolean) =>
      compareReview(
        await compileCatalogue(config),
        config,
        git,
        "main",
        undefined,
        undefined,
        [],
        useFastPath === undefined ? {} : { useFastPath },
      ),
  };
}
