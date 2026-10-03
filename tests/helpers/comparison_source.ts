/** Authored fixtures covering changed, added, removed, and light-only screens. */
export function comparisonEntrySource(changed: boolean): string {
  const third = changed ? "added" : "removed";
  return `import { defineScreen } from "@mokly/mokly";
import React from "react";
const metadata = { relatedDocs: ["notes.md"] };
export const mockups = [
  defineScreen({ ...metadata, navPath: ["Fixture"], id: "home", title: "Home", description: "Home screen", useCaseIds: [],
    mobile: <main><h1>${changed ? "Current" : "Previous"} home</h1><a id="snapshot-link" href="mock:details" target="_top">Details</a></main>,
    desktop: <main><h1>${changed ? "Current" : "Previous"} home</h1><a id="snapshot-link" href="mock:details" target="_top">Details</a></main> }),
  defineScreen({ ...metadata, navPath: ["Fixture"], colorSchemes: ["light"], id: "details", title: "Details", description: "Details screen", useCaseIds: [], mobile: <main>Details</main>, desktop: <main>Details</main> }),
  defineScreen({ ...metadata, navPath: ["Fixture"], id: "${third}", title: "${third === "added" ? "Added" : "Removed"}", description: "One-sided screen", useCaseIds: [], mobile: <main>${third}</main>, desktop: <main>${third}</main> })
];`;
}
