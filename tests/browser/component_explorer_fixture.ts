import path from "node:path";

import { renderReviewArtifact } from "../../dist/review/artifact.js";
import { compareReview } from "../../dist/review/compare.js";
import { writeReviewArtifact } from "../../dist/review/write.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import type { RunningServer } from "../../dist/server/http_types.js";
import { componentEntrySource } from "../helpers/component_fixture.js";
import { componentReviewFixture } from "../helpers/component_review_fixture.js";

export async function createExplorerFixture() {
  const cleanup: (() => Promise<void>)[] = [];
  let server: RunningServer;
  const close = async () => {
    for (const dispose of cleanup.reverse()) await dispose();
  };
  try {
    const fixture = await componentReviewFixture(
      {
        after: (fn) => {
          cleanup.push(fn);
        },
      },
      (source) =>
        source
          .replace(
            "<button data-viewport=",
            '<button className="revised" data-viewport=',
          )
          .replace(
            '{ id: "action-disabled", title: "Disabled", description: "The saved action is unavailable.", props: { label: "Continue", disabled: true } }]',
            '{ id: "action-disabled", title: "Disabled", description: "The saved action is unavailable.", props: { label: "Continue", disabled: true } }, { id: "action-new", title: "New", props: { label: "New" } }]',
          ),
      componentEntrySource({
        body: '<pane.Component><p>Screen content</p><action.Component label="Slot action" /></pane.Component><action.Component moklyInstance="footer" label="Finish" /><action.Component moklyInstance="hidden" label="Hidden" hidden /><MockLink to="action">Open Action</MockLink><MockLink to="action-disabled">Open Disabled Action</MockLink>',
      }).replace(
        '{ id: "action-disabled", title: "Disabled", props:',
        '{ id: "action-disabled", title: "Disabled", description: "The saved action is unavailable.", props:',
      ),
    );
    const compared = await compareReview(
      fixture.after,
      fixture.config,
      fixture.git,
      "main",
    );
    if (compared.result.schemaVersion !== 5)
      throw new Error("Expected component result");
    const result = compared.result;
    server = await startCatalogueServer(fixture.config, {
      base: "main",
      port: 0,
      componentChanges: { baseline: fixture.before.manifest, result },
      changedIds: result.components.flatMap((component) =>
        component.variants
          .filter((variant) => variant.state !== "unchanged")
          .map((variant) => variant.id),
      ),
      review: {
        base: "main",
        outDir: path.join(fixture.root, ".review"),
        generate: async () => {
          await writeReviewArtifact(
            renderReviewArtifact(compared),
            path.join(fixture.root, ".review"),
            fixture.config,
          );
        },
      },
    });
    fixture.beforeRemove(() => server.close());

    return { server, close };
  } catch (error) {
    await close();
    throw error;
  }
}
