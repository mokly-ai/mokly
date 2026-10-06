import { readCatalogueChanges } from "../../packages/mokly/dist/server/component_changes.js";
import { configuredServedReview } from "../../packages/mokly/dist/server/configured_review.js";
import { startCatalogueServer } from "../../packages/mokly/dist/server/http.js";
import type { RunningServer } from "../../packages/mokly/dist/server/http_types.js";
import { componentReviewFixture } from "../helpers/component_review_fixture.js";

/** Serve selected comparisons with real screen and saved-variant snapshots. */
export async function selectedComparisonFixture(lifecycle: {
  after(dispose: () => Promise<void>): void;
}): Promise<RunningServer> {
  const fixture = await componentReviewFixture(lifecycle, (source) =>
    source
      .replaceAll("Continue", "Proceed")
      .replaceAll("Screen content", "Updated screen"),
  );
  const changes = await readCatalogueChanges(
    fixture.config,
    fixture.after.manifest,
    "HEAD",
    fixture.git,
    "a".repeat(40),
  );
  const server = await startCatalogueServer(fixture.config, {
    base: "HEAD",
    port: 0,
    manifest: fixture.after.manifest,
    componentChanges: changes,
    review: configuredServedReview(fixture.config, "HEAD", fixture.git),
  });
  fixture.beforeRemove(() => server.close());
  return server;
}
