import type { ParsedResource } from "../html_link_validation.js";
import { htmlResource } from "../html_link_validation.js";
import {
  extractCssReferences,
  extractHtmlReferences,
} from "../html_references.js";

import type { GeneratedFile } from "./generated_file.js";

/** Explicit text/bytes distinction for one output in the pending generation. */
export type PendingGeneratedFile =
  | { readonly kind: "html"; readonly text: string }
  | { readonly kind: "css"; readonly text: string }
  | { readonly kind: "bytes"; readonly bytes: Uint8Array };

/** The sole compilation-time view of pending HTML, CSS and opaque assets. */
export class PendingGeneratedFiles {
  private readonly files = new Map<string, PendingGeneratedFile>();
  private readonly htmlRoutes: ReadonlySet<string>;

  constructor(
    styles: ReadonlyMap<string, GeneratedFile>,
    htmlRoutes: Iterable<string> = [],
    private readonly renderHtml?: (route: string) => string,
  ) {
    this.htmlRoutes = new Set(htmlRoutes);
    for (const [route, content] of styles) {
      if (route.endsWith(".css") && typeof content === "string")
        this.files.set(route, { kind: "css", text: content });
      else if (typeof content !== "string")
        this.files.set(route, { kind: "bytes", bytes: content });
      else throw new Error(`generated asset is not opaque bytes: ${route}`);
    }
  }

  /** Include a newly rendered document without confusing it with an asset. */
  addHtml(route: string, text: string): void {
    this.files.set(route, { kind: "html", text });
  }

  /** Add completed HTML views to the same pending generation as the styles. */
  addHtmlMap(documents: ReadonlyMap<string, string>): void {
    for (const [route, text] of documents) this.addHtml(route, text);
  }

  /** A declared on-demand view also exists before its HTML is rendered. */
  has(route: string): boolean {
    return this.files.has(route) || this.htmlRoutes.has(route);
  }

  /** Return one file, rendering only a declared on-demand HTML view lazily. */
  get(route: string): PendingGeneratedFile | undefined {
    const file = this.files.get(route);
    if (file) return file;
    if (this.htmlRoutes.has(route) && this.renderHtml)
      return { kind: "html", text: this.renderHtml(route) };
  }

  /** Parse only text resources; opaque assets are existence-only. */
  resource(route: string): ParsedResource | undefined {
    const file = this.get(route);
    if (!file) return;
    if (file.kind === "html")
      return htmlResource(extractHtmlReferences(file.text));
    if (file.kind === "css")
      return {
        anchors: new Set(),
        references: extractCssReferences(file.text).map((value) => ({
          checkFragment: false,
          value,
        })),
      };
    return { anchors: new Set(), references: [] };
  }

  /** All pending routes, including not-yet-rendered on-demand views. */
  routes(): ReadonlySet<string> {
    return new Set([...this.files.keys(), ...this.htmlRoutes]);
  }

  /** CSS outputs must be checked even when a page does not link them. */
  stylesheetRoutes(): readonly string[] {
    return [...this.files].flatMap(([route, file]) =>
      file.kind === "css" ? [route] : [],
    );
  }
}
