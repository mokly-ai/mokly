import path from "node:path";

import type { ManifestV5 } from "@mokly/viewer/data";

import type { WatchReport } from "../../server/reporter.js";

import { truncateTerminalLine, type TerminalGlyphs } from "./terminal.js";

/** Render nonzero user-facing kinds from one accepted manifest. */
export function catalogueCounts(manifest: ManifestV5): string[] {
  return [
    ["screen", "screen"],
    ["page", "page"],
    ["component", "component"],
  ]
    .map(
      ([kind, label]) =>
        [
          manifest.entries.filter((entry) => entry.kind === kind).length,
          label,
        ] as const,
    )
    .filter(([count]) => count > 0)
    .map(([count, label]) => `${count} ${label}${count === 1 ? "" : "s"}`);
}

/** Format up to three repository-relative candidates from a watch burst. */
export function reportPaths(report: WatchReport): string {
  const paths = report.paths.map((candidate) => {
    const relative = path.relative(report.repoRoot, candidate);
    return relative && !relative.startsWith("..") ? relative : candidate;
  });
  const visible = paths.slice(0, 3);
  if (paths.length > 3) visible.push(`+${paths.length - 3} more`);
  return visible.join(", ") || "catalogue";
}

/** Render a content-width URL panel within the available terminal columns. */
export function serveUrlPanel(
  url: string,
  columns: number,
  glyphs: TerminalGlyphs,
): readonly [string, string, string] {
  const indent = "  ";
  const maximumInnerWidth = Math.max(1, columns - indent.length - 2);
  const innerWidth = Math.min(url.length + 4, maximumInnerWidth);
  const paddingWidth = innerWidth >= 5 ? 2 : innerWidth >= 3 ? 1 : 0;
  const urlWidth = Math.max(1, innerWidth - paddingWidth * 2);
  const visibleUrl = truncateTerminalLine(url, urlWidth).padEnd(urlWidth);
  const padding = " ".repeat(paddingWidth);
  const horizontal = glyphs.box.horizontal.repeat(innerWidth);
  return [
    `${indent}${glyphs.box.topLeft}${horizontal}${glyphs.box.topRight}`,
    `${indent}${glyphs.box.vertical}${padding}${visibleUrl}${padding}${glyphs.box.vertical}`,
    `${indent}${glyphs.box.bottomLeft}${horizontal}${glyphs.box.bottomRight}`,
  ];
}

/** Format one local watch timestamp. */
export function watchTimestamp(milliseconds: number): string {
  return new Date(milliseconds).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Select the active and completed copy for one serialized watch action. */
export function watchCopy(
  action: WatchReport["action"],
  glyphs: TerminalGlyphs,
): { active: string; complete: string; glyph: string } {
  switch (action) {
    case "reconfigure":
      return {
        active: "Reloading configuration for",
        complete: "config reloaded, restarted",
        glyph: glyphs.restart,
      };
    case "rebuild":
      return {
        active: "Rebuilding",
        complete: "rebuilt",
        glyph: glyphs.rebuild,
      };
    case "reload":
      return {
        active: "Reloading",
        complete: "reloaded",
        glyph: glyphs.reload,
      };
    case "restart":
      return {
        active: "Restarting",
        complete: "restarted",
        glyph: glyphs.restart,
      };
    case "evidence":
      return {
        active: "Refreshing comparison for",
        complete: "comparing again",
        glyph: glyphs.evidence,
      };
    case "ignore":
      return { active: "Ignoring", complete: "ignored", glyph: glyphs.warning };
  }
}
