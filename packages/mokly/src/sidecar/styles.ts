import type { ReactNode } from "react";

import type { Generation } from "./bundle.js";
import { registryStyles } from "./registry-styles.js";

/** Optional adapters use the consumer's packages and one render-local sheet. */
export function collectStyles(
  generation: Generation,
  render: (node: ReactNode) => string,
  node: ReactNode,
): { html: string; styles: string[] } {
  const styles: string[] = [];
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
  const styled = generation.exports?.styleAdapters
    ?.styled as ReturnType<NodeJS.Require>;
  const sheet = styled ? new styled.ServerStyleSheet() : undefined;
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
    const emotion = generation.exports?.styleAdapters
      ?.emotion as ReturnType<NodeJS.Require>;
    const createCache = optional("@emotion/cache");
    const createServer = optional("@emotion/server/create-instance");
    let emotionServer;
    if (emotion && createCache && createServer) {
      const cache = (createCache.default ?? createCache)({ key: "mokly" });
      emotionServer = (createServer.default ?? createServer)(cache);
      node = React.createElement(emotion.CacheProvider, { value: cache }, node);
    }
    const html = render(node);
    if (emotionServer) {
      const extracted = emotionServer.extractCritical(html);
      if (extracted.css) styles.push(extracted.css);
    }
    if (sheet) {
      const elements = sheet.getStyleElement();
      for (const element of elements) {
        const text = element.props.dangerouslySetInnerHTML?.__html;
        if (text) styles.push(text);
      }
    }
    const registry = registryStyles(nativeSheet(), html);
    if (registry) styles.push(registry);
    return { html, styles };
  } finally {
    sheet?.seal();
  }
}
