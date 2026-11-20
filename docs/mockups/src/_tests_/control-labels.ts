import { parseFragment } from "parse5";

import { attribute, elements, textContent } from "./design-site-test-helpers";

/** Labels drawn by Firna controls, independent of surrounding screen copy. */
export function controlLabels(html: string): string[] {
  return elements(
    parseFragment(html),
    (element) =>
      /^firna-button-[a-z]+$/.test(attribute(element, "data-testid") ?? "") ||
      attribute(element, "role") === "radio",
  )
    .map((element) =>
      (attribute(element, "role") === "radio"
        ? (attribute(element, "aria-label") ?? textContent(element))
        : textContent(element)
      )
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}
