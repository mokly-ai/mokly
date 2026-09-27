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
      'const plain = defineScreen({ ...metadata, id: "plain", title: "Plain", description: "No component instances", route: "screens/plain.html", mobile: <main className="plain">Plain</main>, desktop: <main className="plain">Plain</main> });',
    exports: "action.entry, pane.entry, plain,",
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
    renderer?: { before: string; after: string };
  } = {},
) {
  const fixture = await changedFixture(
    t,
    options.source ?? inlineComponentSource(),
    {
      extraConfig: `renderer: "renderer.tsx", ${options.colorSchemes === false ? "" : 'colorSchemes: ["light", "dark"], '}`,
    },
    ({ root }) =>
      fs.writeFile(
        path.join(root, "renderer.tsx"),
        options.renderer?.before ?? inlineRenderer(beforeStyles),
      ),
  );
  if (options.afterSource)
    await fs.writeFile(fixture.entryPath, options.afterSource);
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    options.renderer?.after ?? inlineRenderer(afterStyles),
  );
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
