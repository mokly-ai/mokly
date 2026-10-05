import { createContext, useContext } from "react";

import { libraryStyleFiles, type LibraryStyle } from "./style_files.js";

/** A collector belongs to one synchronous render, including transient prop renders. */
export class DesignStyleCollector {
  private readonly requested = new Set<LibraryStyle>();
  private readonly candidates = new Map<string, LibraryStyle>();

  constructor(private readonly configured: readonly string[]) {
    for (const href of configured) {
      const file = href.replace(/^(?:\.\.\/|\.\/)+/, "");
      for (const name of Object.keys(libraryStyleFiles) as LibraryStyle[]) {
        if (file === libraryStyleFiles[name]) this.candidates.set(href, name);
      }
    }
  }

  request(name: LibraryStyle): void {
    if (![...this.candidates.values()].includes(name))
      throw new Error(
        `Design component stylesheet is not configured: ${libraryStyleFiles[name]}`,
      );
    this.requested.add(name);
  }

  stylesheets(): readonly string[] {
    return this.configured.filter((href) => {
      const name = this.candidates.get(href);
      return name === undefined || this.requested.has(name);
    });
  }
}

export const DesignStyles = createContext<DesignStyleCollector | undefined>(
  undefined,
);

export function useDesignStyle(name: LibraryStyle, rendered = true): void {
  const collector = useContext(DesignStyles);
  if (!collector)
    throw new Error(
      "Design components require the example renderer's style collector.",
    );
  if (rendered) collector.request(name);
}
