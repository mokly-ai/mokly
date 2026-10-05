import assert from "node:assert/strict";

import type { designDocument } from "./design_catalogue.js";
import { attribute, byClass } from "./design_catalogue.js";

export function componentSection(
  document: Awaited<ReturnType<typeof designDocument>>["document"],
): ReturnType<typeof byClass>[number] {
  const section = byClass(document, "mbk-nav-section").find(
    (candidate) => attribute(candidate, "data-nav-section") === "components",
  );
  assert.ok(section, "Missing Components navigation section");
  return section;
}
