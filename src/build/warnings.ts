import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { escapeTerminalControlCharacters } from "../diagnostics/terminal_text.js";

import type { BuildDiagnostic } from "./build_warnings.js";

/** Removed inputs are warning producers, never comparison evidence. */
export function removedDependencies(
  path: string,
  kind: "entry" | "folder" = "entry",
): BuildDiagnostic {
  return {
    code: "removed-dependencies",
    subject: { kind, path },
    message: "dependencies has been removed; ignoring it. Delete the field.",
  };
}

export function removedOwnedDependencies(path: string): BuildDiagnostic {
  return {
    code: "removed-owned-dependencies",
    subject: { kind: "component", path },
    message:
      "ownedDependencies has been removed; ignoring it. Delete the field.",
  };
}

export function removedSharedImpact(
  configPath: string,
  repoRoot?: string,
): BuildDiagnostic {
  const relative = repoRoot
    ? path.relative(repoRoot, configPath)
    : path.basename(configPath);
  return {
    code: "removed-shared-impact",
    subject: {
      kind: "configuration",
      path: isSafeRepositoryPath(relative.split(path.sep).join("/"))
        ? relative.split(path.sep).join("/")
        : path.basename(configPath),
    },
    message:
      "review.sharedImpact has been removed; ignoring it. Delete the field.",
  };
}

export function duplicateComponentStylesheet(
  componentPath: string,
  publicPath: string,
): BuildDiagnostic {
  return {
    code: "duplicate-component-stylesheet",
    subject: { kind: "component", path: componentPath },
    message: `duplicate component stylesheet ${quoted(publicPath)} is ignored; it is linked once.`,
  };
}

export function missingConfiguredStylesheetLink(
  route: string,
  href: string,
): BuildDiagnostic {
  return {
    code: "missing-configured-stylesheet-link",
    route,
    message: `configured stylesheet link ${quoted(href)} is absent; component stylesheets use another anchor.`,
  };
}

export function ignoredStylesheetResourceOwner(
  route: string,
  publicPath: string,
): BuildDiagnostic {
  return {
    code: "ignored-stylesheet-resource-owner",
    route,
    message: `Stylesheet ownership for ${quoted(publicPath)} is ignored. Changes follow the elements that each changed rule matches.`,
  };
}

function quoted(value: string): string {
  return escapeTerminalControlCharacters(JSON.stringify(value));
}

/** Inline rules infer their owners from rendered component boundaries. */
export function ignoredRendererStyles(route: string): BuildDiagnostic {
  return {
    code: "ignored-renderer-styles",
    route,
    message:
      "Renderer styles ownership is ignored. Mokly infers inline style ownership from rendered markup.",
  };
}
