import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { MoklyError, errorMessage } from "../errors.js";
import { serializeReviewSentinels } from "../renderer/sentinels.js";

import { GENERATED_MARKER } from "./generated_marker.js";

/** Capture a complete document once, outside viewport/component rendering. */
export function renderPage(
  entry: ResolvedRegistryEntry & { kind: "page" },
): string {
  let rendered: unknown;
  try {
    rendered = entry.render();
  } catch (error) {
    throw new MoklyError(
      "build-invalid",
      `page render failed for ${entry.id} (${entry.sourceRelativePath}): ${errorMessage(error)}`,
      { cause: error },
    );
  }
  if (
    typeof rendered !== "string" ||
    !/<html[\s>]/i.test(rendered) ||
    !/<\/html\s*>/i.test(rendered)
  ) {
    if (rendered instanceof Promise) void rendered.catch(() => undefined);
    throw new MoklyError(
      "build-invalid",
      `page render must return a complete HTML document synchronously for ${entry.id} (${entry.sourceRelativePath})`,
    );
  }
  return `${GENERATED_MARKER}${serializeReviewSentinels(rendered)}`;
}
