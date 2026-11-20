import { parseFragment } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";

/** Consumers only read the tree. Changed HTML needs a new owner. */
export class HtmlInput {
  private parsed: DefaultTreeAdapterMap["documentFragment"] | undefined;

  constructor(readonly html: string) {}

  get tree(): DefaultTreeAdapterMap["documentFragment"] {
    return (this.parsed ??= parseFragment(this.html, {
      sourceCodeLocationInfo: true,
    }));
  }
}
