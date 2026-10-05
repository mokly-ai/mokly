/** Authored fixtures covering changed, added, removed, and light-only screens. */
export function comparisonEntrySource(changed: boolean): string {
  const third = changed ? "added" : "removed";
  return `import { defineScreen } from "@mokly/mokly";
import React from "react";
const metadata = { relatedDocs: ["notes.md"] };
export const mockups = [
  defineScreen({ ...metadata, path: "home", title: "Home", description: "Home screen", useCasePaths: [],
    mobile: <main><h1>${changed ? "Current" : "Previous"} home</h1><a id="snapshot-link" href="mock:details" target="_top">Details</a></main>,
    desktop: <main><h1>${changed ? "Current" : "Previous"} home</h1><a id="snapshot-link" href="mock:details" target="_top">Details</a></main> }),
  defineScreen({ ...metadata, colorSchemes: ["light"], path: "details", title: "Details", description: "Details screen", useCasePaths: [], mobile: <main>Details</main>, desktop: <main>Details</main> }),
  defineScreen({ ...metadata, path: "${third}", title: "${third === "added" ? "Added" : "Removed"}", description: "One-sided screen", useCasePaths: [], mobile: <main>${third}</main>, desktop: <main>${third}</main> })
];`;
}
