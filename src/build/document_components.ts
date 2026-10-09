import type { ComponentViewRecord } from "@mokly/viewer";
import { validateComponentViewRecord } from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { validateComponentResources } from "../components/output_validation.js";
import { validateComponentRanges } from "../components/ranges.js";
import type { LinkedComponentStylesheet } from "../components/render.js";
import { finalizeComponentStylesheets } from "../components/stylesheet_provenance.js";
import type { PublicFilePolicy } from "../config/public_policy.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import type { PendingGeneratedFiles } from "./pending_generated.js";

/** Record final link provenance before validating the captured view. */
export function finalizeDocumentView(input: {
  route: string;
  entry: ResolvedRegistryEntry;
  html: string;
  captured: ComponentViewRecord | undefined;
  config: ResolvedConfig;
  links: readonly LinkedComponentStylesheet[];
  components: Parameters<typeof validateComponentViewRecord>[1];
  pending: PendingGeneratedFiles;
  policy?: PublicFilePolicy;
}): { html: string; view?: ComponentViewRecord } {
  const { route, entry, captured, config, links, components, pending } = input;
  if (!captured) return { html: input.html };
  if (entry.kind !== "screen" && entry.kind !== "component")
    throw new MoklyError(
      "build-invalid",
      `${route}: unexpected component view`,
    );
  const finalized = finalizeComponentStylesheets(
    input.html,
    captured,
    route,
    config.mockupsDir,
    links,
  );
  const view = finalized.view;
  validateComponentRanges(finalized.html, view.ranges);
  validateComponentViewRecord(
    view,
    components,
    route,
    entry.kind === "component" && "variantOf" in entry
      ? { rootId: entry.variantOf }
      : {},
  );
  validateComponentResources(
    new Map([[route, view]]),
    config,
    pending,
    input.policy,
  );
  return { html: finalized.html, view };
}
