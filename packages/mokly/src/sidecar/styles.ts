import type { ReactNode } from "react";

import type { StyleCapture } from "../authoring/runtime.js";
import type { CollectedStyle } from "../generated/sidecar/CollectedStyle.js";

import type { Generation } from "./bundle.js";
import { emotionOwners } from "./emotion-ownership.js";
import type { EmotionCache } from "./emotion-ownership.js";
import { registryStyles } from "./registry-styles.js";
import type { InlineAttribution } from "./style-ownership.js";
import { styledOwners } from "./styled-ownership.js";
import type { StyledAdapter } from "./styled-ownership.js";

/** Delivery uses the original sheet bytes. Comparison uses separate rule owners. */
export function collectStyles(
  generation: Pick<Generation, "runtime" | "require" | "exports">,
  render: (node: ReactNode) => string,
  node: ReactNode,
  entryOwner?: string,
): {
  html: string;
  styles: CollectedStyle[];
  inlineAttribution: InlineAttribution;
} {
  const styles: CollectedStyle[] = [];
  const React = generation.runtime.react;
  const optional = (name: string) => {
    try {
      return generation.require(name);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "MODULE_NOT_FOUND"
      )
        return undefined;
      throw error;
    }
  };
  const styled = generation.exports?.styleAdapters?.styled as
    StyledAdapter | undefined;
  const sheet = styled ? new styled.ServerStyleSheet() : undefined;
  const styledCapture = sheet
    ? styledOwners(sheet.instance, entryOwner)
    : undefined;
  const native = generation.exports?.styleAdapters
    ?.native as ReturnType<NodeJS.Require>;
  if (native)
    native.AppRegistry.registerComponent(
      "__mokly_sidecar_styles__",
      () => () => null,
    );
  const nativeSheet = () =>
    native?.AppRegistry.getApplication(
      "__mokly_sidecar_styles__",
    ).getStyleElement().props.dangerouslySetInnerHTML.__html ?? "";
  try {
    if (sheet) node = sheet.collectStyles(node);
    const emotion = generation.exports?.styleAdapters?.emotion as
      | {
          CacheProvider: React.ElementType;
          __unsafe_useEmotionCache(): EmotionCache | null;
        }
      | undefined;
    const createCache = optional("@emotion/cache");
    const createServer = optional("@emotion/server/create-instance");
    let emotionCapture: ReturnType<typeof emotionOwners> | undefined;
    let emotionServer:
      | { extractCritical(html: string): { css: string; ids: string[] } }
      | undefined;
    if (emotion && createCache && createServer) {
      const cache: EmotionCache = (createCache.default ?? createCache)({
        key: "mokly",
      });
      // Server extraction enables compat mode before rendering, as in ordinary SSR.
      emotionServer = (createServer.default ?? createServer)(cache);
      emotionCapture = emotionOwners(cache);
      node = React.createElement(
        emotion.CacheProvider,
        { value: emotionCapture.forOwner(entryOwner) },
        node,
      );
    }
    function Scope({
      owner,
      children,
    }: {
      owner: string | undefined;
      children: ReactNode;
    }) {
      let output = children;
      if (styled && styledCapture) {
        const context = React.useContext(styled.StyleSheetContext);
        output = React.createElement(
          styled.StyleSheetContext.Provider,
          {
            value: {
              ...context,
              styleSheet: styledCapture.forOwner(owner, context.styleSheet),
            },
          },
          output,
        );
      }
      if (emotion && emotionCapture) {
        const cache = emotion.__unsafe_useEmotionCache();
        output = React.createElement(
          emotion.CacheProvider,
          {
            value: emotionCapture.forOwner(owner, cache),
          },
          output,
        );
      }
      return output;
    }
    const capture: StyleCapture = {
      entryOwner,
      wrap: (owner, children) =>
        React.createElement(Scope, { owner, children }),
    };
    node = React.createElement(
      generation.runtime.contexts.styles.Provider,
      { value: capture },
      node,
    );
    const html = render(node);
    if (emotionServer && emotionCapture) {
      const extracted = emotionServer.extractCritical(html);
      if (extracted.css)
        styles.push({
          css: extracted.css,
          owners: [],
          attribution: emotionCapture.records(extracted.ids),
        });
    }
    if (sheet) {
      for (const element of sheet.getStyleElement()) {
        const css = element.props.dangerouslySetInnerHTML?.__html;
        if (css)
          styles.push({
            css,
            owners: [],
            attribution: styledCapture!.records(),
          });
      }
    }
    const registry = registryStyles(nativeSheet(), html);
    if (registry) styles.push({ css: registry, owners: [] });
    const emotionInline = emotionCapture?.inlineAttribution();
    const styledInline = styledCapture?.inlineAttribution();
    return {
      html,
      styles,
      inlineAttribution(css, attributes) {
        const emotionToken = attributes.find(
          (attribute) => attribute.name === "data-emotion",
        )?.value;
        if (emotionToken) return emotionInline?.(emotionToken, css);
        if (attributes.some((attribute) => attribute.name === "data-styled"))
          return styledInline?.(css);
        return undefined;
      },
    };
  } finally {
    sheet?.seal();
  }
}
