import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { compareReview } from "../../dist/review/compare.js";
import { committedReviewRepository } from "../../dist/review/repository.js";
import { computeCatalogueChanges } from "../../dist/server/changed.js";

import { changedFixture } from "./changed_fixture.js";
import { componentEntrySource } from "./component_fixture.js";

export function inlineComponentSource(): string {
  return componentEntrySource({
    actionRender:
      '(props) => <button className={`action shared ${props.label === "Finish" ? "actual-only" : props.label === "Slot action" ? "slot-child" : "saved"}`}>{props.label}</button>',
    paneRender:
      '(props) => <section className="pane shared">{props.children}<action.Component label="Inside" /></section>',
    body: '<main className="entry"><pane.Component><span className="slot-content">Screen content</span><action.Component label="Slot action" /></pane.Component><action.Component moklyInstance="footer" label="Finish" /></main>',
    extra:
      'const plain = defineScreen({ ...metadata, id: "plain", title: "Plain", description: "No component instances", mobile: <main className="plain">Plain</main>, desktop: <main className="plain">Plain</main> });',
    exports: "action.entries, pane.entries, plain,",
  });
}

export function inlineRenderer(styles: string): string {
  return `import { renderToStaticMarkup } from "react-dom/server";
export default (input) => '<!doctype html><html><head>${styles}</head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`;
}

export async function inlineChangesFixture(
  t: TestContext,
  beforeStyles: string,
  afterStyles: string,
  options: {
    source?: string;
    afterSource?: string;
    colorSchemes?: boolean;
    files?: {
      before: Readonly<Record<string, string>>;
      after: Readonly<Record<string, string>>;
    };
    renderer?: { before: string; after: string };
  } = {},
) {
  const fixture = await changedFixture(
    t,
    options.source ?? inlineComponentSource(),
    {
      extraConfig: `renderer: "renderer.tsx", ${options.colorSchemes === false ? "" : 'colorSchemes: ["light", "dark"], '}`,
    },
    async ({ root, mockupsDir }) => {
      await fs.writeFile(
        path.join(root, "renderer.tsx"),
        options.renderer?.before ?? inlineRenderer(beforeStyles),
      );
      await writeFiles(mockupsDir, options.files?.before ?? {});
    },
  );
  if (options.afterSource)
    await fs.writeFile(fixture.entryPath, options.afterSource);
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    options.renderer?.after ?? inlineRenderer(afterStyles),
  );
  await writeFiles(fixture.mockupsDir, options.files?.after ?? {});
  await fixture.build();
  const repository = () => committedReviewRepository(fixture.config);
  return {
    ...fixture,
    complete: async (
      useFastPath = true,
      mode: "committed" | "derived" = "committed",
    ) => {
      const config = { ...fixture.config, generatedOutput: mode };
      return compareReview(
        await compileCatalogue(config),
        config,
        repository(),
        "main",
        undefined,
        undefined,
        [],
        { useFastPath },
      );
    },
    live: () => computeCatalogueChanges(fixture.config, "main", repository()),
  };
}

async function writeFiles(
  root: string,
  files: Readonly<Record<string, string>>,
): Promise<void> {
  for (const [route, content] of Object.entries(files)) {
    const target = path.join(root, route);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }
}
