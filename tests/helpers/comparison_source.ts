/** Authored fixtures covering changed, added, removed, and light-only screens. */
export function comparisonEntrySource(changed: boolean): string {
  const third = changed ? "added" : "removed";
  return `import { defineCollection, defineScreen } from "@mokly/mokly";
import React from "react";
const metadata = { relatedDocs: ["notes.md"] };
export const mockups = [
  defineCollection({ ...metadata, childIds: ["home", "details", "${third}"], description: "Fixture collection", id: "fixture", title: "Fixture" }),
  defineScreen({ ...metadata, id: "home", title: "Home", route: "screens/home.html", description: "Home screen", useCaseIds: [],
    mobile: <main><h1>${changed ? "Current" : "Previous"} home</h1><a id="snapshot-link" href="mock:details" target="_top">Details</a></main>,
    desktop: <main><h1>${changed ? "Current" : "Previous"} home</h1><a id="snapshot-link" href="mock:details" target="_top">Details</a></main> }),
  defineScreen({ ...metadata, colorSchemes: ["light"], id: "details", title: "Details", route: "screens/details.html", description: "Details screen", useCaseIds: [], mobile: <main>Details</main>, desktop: <main>Details</main> }),
  defineScreen({ ...metadata, id: "${third}", title: "${third === "added" ? "Added" : "Removed"}", route: "screens/${third}.html", description: "One-sided screen", useCaseIds: [], mobile: <main>${third}</main>, desktop: <main>${third}</main> })
];`;
}
