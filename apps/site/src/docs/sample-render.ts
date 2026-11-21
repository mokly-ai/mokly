import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parse, type DefaultTreeAdapterMap } from "parse5";

import { readCatalogueIndex, type CatalogueNode } from "@mokly/viewer";
import { currentDocumentPath, viewRoute } from "@mokly/viewer/data";

import { requiredMoklyPackagePath } from "../mokly-package.js";

import { sampleLines, type SampleLines } from "./sample-lines.js";

const VIEWPORTS = [
  { viewport: "mobile", name: "Mobile", width: 390, height: 844 },
  { viewport: "desktop", name: "Desktop", width: 1280, height: 800 },
] as const;

export interface SampleView {
  readonly viewport: "mobile" | "desktop";
  readonly width: number;
  readonly height: number;
  readonly state: string;
  readonly stateTitle: string;
  readonly title: string;
  readonly document: string;
  readonly dimmed: readonly number[];
}

export interface RenderedSample {
  readonly title: string;
  readonly path: string;
  readonly lines: SampleLines["lines"];
  readonly views: readonly SampleView[];
}

const cache = new Map<string, Promise<RenderedSample>>();

function treePaths(nodes: readonly CatalogueNode[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.kind === "entry" ? [node.path] : []),
    ...treePaths(node.children ?? []),
  ]);
}

/**
 * Remove every generated script and the frame-probe template.
 * Screens forbid scripts, so every generated script is Mokly plumbing.
 */
function viewDocument(source: string): {
  document: string;
  markers: Set<number>;
} {
  const removed: { start: number; end: number }[] = [];
  const markers = new Set<number>();
  const walk = (node: DefaultTreeAdapterMap["node"]): void => {
    if ("tagName" in node) {
      const attr = (name: string) =>
        node.attrs.find((attr) => attr.name === name)?.value;
      const location = node.sourceCodeLocation;
      if (
        location &&
        ((node.tagName === "template" &&
          attr("data-mokly-frame-probe") !== undefined) ||
          node.tagName === "script")
      )
        removed.push({ start: location.startOffset, end: location.endOffset });
      const marker = attr("data-sample-line");
      if (marker !== undefined) markers.add(Number(marker));
    }
    if ("childNodes" in node) node.childNodes.forEach(walk);
    if ("content" in node) walk(node.content);
  };
  walk(parse(source, { sourceCodeLocationInfo: true }));
  for (const range of removed.sort((a, b) => b.start - a.start))
    source = source.slice(0, range.start) + source.slice(range.end);
  return { document: source, markers };
}

function build(root: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [
        requiredMoklyPackagePath("bin", "mokly.mjs"),
        "build",
        "--no-changes",
        "--out",
        "out",
      ],
      { cwd: root, maxBuffer: 32 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error) reject(new Error(stderr || error.message, { cause: error }));
        else resolve();
      },
    );
  });
}

async function render(sample: string, source: string): Promise<RenderedSample> {
  const marked = sampleLines(source);
  const root = await mkdtemp(path.join(os.tmpdir(), "mokly-guide-sample-"));
  try {
    const file = path.join(root, sample);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(path.join(root, "mokly.config.json"), "{}\n");
    await writeFile(file, `${marked.source}\n`);
    await build(root);
    const output = path.join(root, "out");
    const value: unknown = JSON.parse(
      await readFile(path.join(output, "mokly-viewer/index.json"), "utf8"),
    );
    const index = readCatalogueIndex(value);
    const screen = index.screens.find(
      (entry) =>
        entry.variantOf === undefined && entry.details.sourcePath === sample,
    );
    if (!screen) throw new Error("The sample build produced no screen.");
    const states = [
      screen,
      ...treePaths(index.tree).flatMap((entryPath) => {
        const entry = index.screens.find(
          (candidate) =>
            candidate.path === entryPath && candidate.variantOf === screen.path,
        );
        return entry ? [entry] : [];
      }),
    ];
    const views: SampleView[] = [];
    for (const state of states) {
      for (const size of VIEWPORTS) {
        if (!state.views.some((view) => view.viewport === size.viewport))
          continue;
        const documentPath = currentDocumentPath(
          viewRoute(state.path, size.viewport, "light"),
        );
        const view = viewDocument(
          await readFile(path.join(output, documentPath), "utf8"),
        );
        views.push({
          viewport: size.viewport,
          width: size.width,
          height: size.height,
          state: state.path,
          stateTitle: state.title,
          title: `${screen.title}, ${size.name}, ${state.title}`,
          document: view.document,
          dimmed: marked.lines.flatMap((marker, index) =>
            marker !== null && !view.markers.has(marker) ? [index + 1] : [],
          ),
        });
      }
    }
    if (views.length === 0)
      throw new Error("The sample build produced no views.");
    return {
      title: screen.title,
      path: screen.path,
      lines: marked.lines,
      views,
    };
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

/** Build one isolated sample once per process and keep no generated files. */
export function renderSample(
  sample: string,
  source: string,
): Promise<RenderedSample> {
  const key = JSON.stringify([sample, source]);
  let result = cache.get(key);
  if (!result) {
    result = render(sample, source);
    cache.set(key, result);
  }
  return result;
}
