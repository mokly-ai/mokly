import path from "node:path";

import { generatedResourceRoute } from "@mokly/viewer/data";

import type { PublicFilePolicy } from "../config/public_policy.js";
import type { ResolvedConfig } from "../config/types.js";
import { htmlResource, type ParsedResource } from "../html_link_validation.js";
import {
  extractCssReferences,
  extractHtmlReferences,
} from "../html_references.js";

import type { PendingGeneratedFiles } from "./pending_generated.js";
import { validateImageSetStrings } from "./styles/image_set.js";

/** Read one authorized resource for the shared closure traversal. */
export function loadPublicResource(
  route: string,
  pending: PendingGeneratedFiles,
  policy: PublicFilePolicy,
  config: ResolvedConfig,
): ParsedResource | undefined {
  const generated = generatedResourceRoute(route);
  if (generated !== undefined) return pending.resource(generated);
  if (policy.inspect(route).kind !== "public") return;
  const content = policy.read(route);
  if (!content) return;
  const extension = path.posix.extname(route).toLowerCase();
  if (extension === ".css") {
    const text = content.toString("utf8");
    validateImageSetStrings(
      text,
      path.resolve(config.mockupsDir, route),
      config.repoRoot,
    );
    return {
      anchors: new Set(),
      references: extractCssReferences(text).map((value) => ({
        checkFragment: false,
        value,
      })),
    };
  }
  return /\.html?$/i.test(route)
    ? htmlResource(extractHtmlReferences(content.toString("utf8")))
    : { anchors: new Set(), references: [] };
}
