import assert from "node:assert/strict";

import {
  homePage as renderHomePage,
  notFoundPage as renderNotFoundPage,
  viewPage as renderViewPage,
} from "../../dist/server/pages.js";
import { parseViewHref } from "../../packages/viewer/dist/data.js";
import type { ManifestV8 } from "../../packages/viewer/dist/registry/types.js";
import type { Catalogue } from "../../packages/viewer/dist/shell/catalogue.js";
import type { ShellContext } from "../../packages/viewer/dist/shell/context.js";
import { renderViewer } from "../../packages/viewer/dist/viewer/server.js";

import { publicShellContext } from "./public_shell.js";

export const manifest: ManifestV8 = {
  entries: [
    {
      kind: "page",
      path: "example/old",
      title: "Old",
      description: "Original complete document",
      sourcePath: "entries/fixture.mockup.tsx",
      declaredDependencies: [],
      relatedDocs: [],
    },
    {
      kind: "page",
      path: "example/overview",
      title: "Overview",
      description: "Catalogue overview",
      sourcePath: "entries/fixture.mockup.tsx",
      declaredDependencies: [],
      relatedDocs: [],
    },
    {
      address: "example.test/welcome",
      colorSchemes: ["light"],
      declaredDependencies: ["styles.css"],
      description: "Landing screen",
      path: "example/screens/welcome",
      kind: "screen",

      rationale: "Proves the shell",
      relatedDocs: ["notes.md"],
      sourcePath: "entries/fixture.mockup.tsx",
      tags: ["forms", "onboarding"],
      title: "Welcome",
      useCasePaths: ["example/tour"],
    },
    {
      declaredDependencies: [],
      colorSchemes: ["light"],
      description: "Second screen",
      path: "example/screens/details",
      kind: "screen",

      relatedDocs: [],
      sourcePath: "entries/fixture.mockup.tsx",
      tags: ["billing"],
      title: "Details",
      useCasePaths: ["example/tour"],
    },
    {
      declaredDependencies: [],
      description: "Ordered journey",
      path: "example/tour",
      kind: "use-case",

      relatedDocs: [],
      sourcePath: "entries/fixture.mockup.tsx",
      steps: [
        { screenPath: "example/screens/welcome" },
        { screenPath: "example/screens/details" },
      ],
      title: "Tour",
    },
  ],
  generatedBy: "mokly",
  sourceFiles: ["entries/fixture.mockup.tsx"],
  schemaVersion: 8 as const,
  folders: [],
};

export const darkManifest: ManifestV8 = {
  ...manifest,
  entries: manifest.entries.map((entry) =>
    entry.kind === "screen" && entry.path === "example/screens/welcome"
      ? {
          ...entry,
          colorSchemes: ["light", "dark"],
        }
      : entry,
  ),
};

export const taggedFlowManifest: ManifestV8 = {
  ...manifest,
  entries: manifest.entries.map((entry) =>
    entry.kind === "use-case"
      ? { ...entry, tags: ["onboarding", "walkthrough"] }
      : entry,
  ),
};

export const untaggedManifest: ManifestV8 = {
  ...manifest,
  entries: manifest.entries.map((entry) => {
    const { tags: _tags, ...untagged } = entry;
    return untagged;
  }),
};

export const context = {
  base: "origin/main",
  updateVersion: 1,
};

export function homePage(catalogue: Catalogue, value: ShellContext): string {
  return renderHomePage(catalogue, publicShellContext(catalogue, value));
}

export function notFoundPage(
  detail: string,
  catalogue: Catalogue,
  value: ShellContext,
): string {
  return renderNotFoundPage(
    detail,
    catalogue,
    publicShellContext(catalogue, value),
  );
}

export function viewPage(
  entry: Parameters<typeof renderViewPage>[0],
  catalogue: Catalogue,
  value: ShellContext,
): string {
  return renderViewPage(entry, catalogue, publicShellContext(catalogue, value));
}

export function routePage(
  catalogue: Catalogue,
  route: string,
  extra: Partial<ShellContext> = {},
): string {
  const identity = parseViewHref(`/view/${route}`);
  assert.ok(identity);
  const entry = catalogue.byPath.get(identity);
  assert.ok(entry);
  return viewPage(entry, catalogue, {
    ...context,
    activeId: entry.path,
    ...extra,
  });
}

export function embeddedPage(
  catalogue: Catalogue,
  screenPath: string | null,
): string {
  const { readModel } = publicShellContext(catalogue, context);
  return renderViewer({
    viewerId: "shell-test",
    catalogue: readModel,
    baseUrl: "https://catalogue.example",
    defaultSelection: { screenPath },
  });
}
