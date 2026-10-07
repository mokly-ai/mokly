import { readCatalogueChanges } from "../../dist/server/component_changes.js";
import { configuredServedReview } from "../../dist/server/configured_review.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import type { RunningServer } from "../../dist/server/http_types.js";
import { componentEntrySource } from "../helpers/component_fixture.js";
import { componentReviewFixture } from "../helpers/component_review_fixture.js";

export async function startComponentExplorer(
  cleanup: (() => Promise<void>)[],
): Promise<RunningServer> {
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
          '{ slug: "disabled", title: "Disabled", description: "The saved action is unavailable.", props: { label: "Continue", disabled: true } }]',
          '{ slug: "disabled", title: "Disabled", description: "The saved action is unavailable.", props: { label: "Continue", disabled: true } }, { slug: "new", title: "New", props: { label: "New" } }]',
        ),
    componentEntrySource({
      body: '<pane.Component><p>Screen content</p><action.Component label="Slot action" /></pane.Component><action.Component moklyInstance="footer" label="Finish" /><action.Component moklyInstance="hidden" label="Hidden" hidden /><MockLink to="action">Open Action</MockLink><MockLink to="action/disabled">Open Disabled Action</MockLink>',
    }).replace(
      '{ slug: "disabled", title: "Disabled", props:',
      '{ slug: "disabled", title: "Disabled", description: "The saved action is unavailable.", props:',
    ),
  );

  const changes = await readCatalogueChanges(
    fixture.config,
    fixture.after.manifest,
    "main",
    fixture.git,
    "a".repeat(40),
  );

  if (!changes.result) throw new Error("Expected component result");

  const result = changes.result;

  const server = await startCatalogueServer(fixture.config, {
    base: "main",
    port: 0,
    generatedOutputs: fixture.after.outputs,
    componentChanges: changes,
    changedEntries: result.components.flatMap((component) =>
      component.variants
        .filter((variant) => variant.state !== "unchanged")
        .map((variant) => variant.path),
    ),
    review: configuredServedReview(fixture.config, "main", fixture.git),
  });

  fixture.beforeRemove(() => server.close());
  return server;
}
