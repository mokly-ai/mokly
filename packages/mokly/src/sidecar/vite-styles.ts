import { createHash } from "node:crypto";

import type { Rollup } from "vite";

interface Wrapper {
  file: string;
  registry: string;
  adapter: "styled" | "native" | "emotion";
}

type StyleModule = Pick<Rollup.PartialResolvedId, "id" | "external">;
type StyleResolve = (
  source: string,
  importer: string | undefined,
  options: { skipSelf: boolean },
) => Promise<StyleModule | null>;

/** Capture each style library's own registry through the same Vite resolution. */
export class ViteStyles {
  private wrappers = new Map<string, Wrapper>();
  private originals = new Map<string, StyleModule>();

  original(source: string, importer?: string): StyleModule | undefined {
    if (!source.startsWith("mokly:style-source:")) return;
    if (!importer?.startsWith("\0mokly-style:"))
      throw new Error("Mokly's style adapter source is reserved");
    return this.originals.get(source.slice("mokly:style-source:".length));
  }

  async resolve(
    source: string,
    importer: string | undefined,
    resolve: StyleResolve,
  ): Promise<string | StyleModule | undefined> {
    if (source.startsWith("mokly:style-source:")) {
      return this.original(source, importer);
    }
    const library =
      /^(styled-components|react-native-web|@emotion\/react)(?:\/|$)/.exec(
        source,
      )?.[1];
    if (!library) return;
    const resolved = await resolve(source, importer, { skipSelf: true });
    if (!resolved) return;
    const registry =
      source === library
        ? resolved
        : await resolve(library, resolved.id, { skipSelf: true });
    if (!registry) throw new Error(`could not resolve ${library}`);
    this.originals.set(resolved.id, resolved);
    this.originals.set(registry.id, registry);
    const id =
      "\0mokly-style:" +
      createHash("sha256")
        .update(JSON.stringify([resolved.id, registry.id, importer]))
        .digest("hex");
    this.wrappers.set(id, {
      file: resolved.id,
      registry: registry.id,
      adapter:
        library === "styled-components"
          ? "styled"
          : library === "react-native-web"
            ? "native"
            : "emotion",
    });
    return id;
  }

  source(id: string): string | undefined {
    const wrapper = this.wrappers.get(id);
    if (!wrapper) return;
    const original = JSON.stringify(`mokly:style-source:${wrapper.file}`);
    const registry = JSON.stringify(`mokly:style-source:${wrapper.registry}`);
    return [
      `import * as original from ${original}; export * from ${original}; export default original.default;`,
      ...(wrapper.file === wrapper.registry
        ? []
        : [`import * as registry from ${registry};`]),
      `import runtime from "mokly:runtime"; runtime.style(${JSON.stringify(wrapper.adapter)}, ${wrapper.file === wrapper.registry ? "original" : "registry"});`,
    ].join("\n");
  }
}
