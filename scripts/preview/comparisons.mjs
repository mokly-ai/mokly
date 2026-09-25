import path from "node:path";

import {
  capturePublicationPagePreviews,
  publicationComparisonMetadata,
  publishPublicationComparison,
} from "../../dist/publication/removed_previews.js";
import { configuredServedReview } from "../../dist/server/configured_review.js";

const comparisonRoute = "/__mokly/diffs/review.json";

/** Keep publishing isolated from another server's configured comparison output. */
export function previewComparisonProvider(
  config,
  stage,
  base,
  git,
  changeEvidence,
) {
  return configuredServedReview(
    {
      ...config,
      review: { ...config.review, outDir: path.join(stage, ".comparisons") },
    },
    base,
    git,
    changeEvidence,
  );
}

/** Resolve the same generation the interactive client would request on demand. */
export async function captureComparison(serverUrl) {
  const response = await fetch(`${serverUrl}${comparisonRoute}`);
  if (!response.ok) {
    const failure = await response.json();
    throw new Error(`preview comparison failed: ${failure.details}`);
  }
  const url = new URL(response.url);
  if (
    url.origin !== new URL(serverUrl).origin ||
    !/^\/__mokly\/diffs\/__generations\/[A-Za-z0-9-]+\/review\.json$/.test(
      url.pathname,
    )
  )
    throw new Error(
      "preview comparison did not resolve an immutable generation",
    );
  return {
    directory: path.posix.dirname(url.pathname).slice(1),
    redirect: `${comparisonRoute} ${url.pathname} 302`,
    result: await response.json(),
  };
}

export { capturePublicationPagePreviews };

/** Move the completed generation into the deployment after the server closes. */
export async function publishComparison(
  provider,
  comparison,
  stage,
  removed,
  pagePreviews = new Map(),
) {
  const published = await publishPublicationComparison(
    provider,
    comparison,
    stage,
    removed,
    pagePreviews,
  );
  return {
    ...published,
    ...comparisonMetadata(`/${published.directory}/review.json`),
  };
}

/** Preserve the repository's immutable-generation alias and hosting policy. */
export function comparisonMetadata(comparisonUrl) {
  return publicationComparisonMetadata(comparisonUrl);
}
