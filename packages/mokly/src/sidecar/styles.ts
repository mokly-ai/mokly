import type { ReactNode } from "react";

import type { CollectedStyle } from "../generated/sidecar/CollectedStyle.js";
import type {
  OwnedStyleSheet,
  RenderSession,
  StyleCapture,
  StyleOwnerRecord,
} from "../authoring/runtime.js";

import type { Generation } from "./bundle.js";
import { registryStyles } from "./registry-styles.js";
import { ownedStyles } from "./style-ownership.js";

interface StyledInstance {
  insertRules: (id: string, name: string, rules: string[]) => unknown;
}

interface StyledSheet extends OwnedStyleSheet {
  instance: StyledInstance;
  collectStyles: (node: ReactNode) => ReactNode;
}

interface StyledAdapter {
  ServerStyleSheet: new () => StyledSheet;
  StyleSheetManager: React.ElementType;
}

interface EmotionSerialized {
  name: string;
  styles: string;
}

interface EmotionCache {
  insert: (
    selector: string,
    serialized: EmotionSerialized,
    sheet: unknown,
    shouldCache: boolean,
  ) => unknown;
}

interface EmotionAdapter {
  CacheProvider: React.ElementType;
}

/** Collect adapter CSS once and attach each rule to its rendering component. */
export function collectStyles(
  generation: Generation,
  render: (node: ReactNode) => string,
  node: ReactNode,
  session: RenderSession,
): { html: string; styles: CollectedStyle[] } {
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
  const records: StyleOwnerRecord[] = [];
  const capture: StyleCapture = { records };
  const styledSheets = new Map<string, StyledInstance>();
  if (styled)
    capture.styled = {
      StyleSheetManager: styled.StyleSheetManager,
      sheetFor: (owner) => {
        let value = styledSheets.get(owner);
        if (!value) {
          value = styleSheet(sheet!.instance, owner, records);
          styledSheets.set(owner, value);
        }
        return value;
      },
    };
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
  let rootEmotion: EmotionCache | undefined;
  let createServer:
    | ((cache: unknown) => {
        extractCritical: (value: string) => { css: string };
      })
    | undefined;
  try {
    const emotion = generation.exports?.styleAdapters?.emotion as
      EmotionAdapter | undefined;
    const createCache = optional("@emotion/cache");
    const serverModule = optional("@emotion/server/create-instance");
    const emotionCaches = new Map<string, EmotionCache>();
    if (emotion && createCache && serverModule) {
      const create = (createCache.default ?? createCache) as (options: {
        key: string;
      }) => EmotionCache;
      rootEmotion = create({ key: "mokly" });
      createServer = (serverModule.default ??
        serverModule) as typeof createServer;
      capture.emotion = {
        CacheProvider: emotion.CacheProvider,
        cacheFor: (owner) => {
          let value = emotionCaches.get(owner);
          if (!value) {
            value = emotionCache(rootEmotion!, owner, records);
            emotionCaches.set(owner, value);
          }
          return value;
        },
      };
      node = React.createElement(
        emotion.CacheProvider,
        { value: rootEmotion },
        node,
      );
    }
    if (sheet) node = sheet.collectStyles(node);
    node = React.createElement(
      generation.runtime.contexts.styles.Provider,
      { value: capture },
      node,
    );
    const html = render(node);
    if (rootEmotion && createServer) {
      const extracted = createServer(rootEmotion).extractCritical(html);
      if (extracted.css)
        styles.push(...ownedStyles(extracted.css, html, session, records));
    }
    if (sheet) addSheet(styles, sheet, html, session, records);
    const registry = registryStyles(nativeSheet(), html);
    if (registry) styles.push(...ownedStyles(registry, html, session, records));
    return { html, styles };
  } finally {
    sheet?.seal();
  }
}

function addSheet(
  styles: CollectedStyle[],
  sheet: StyledSheet,
  html: string,
  session: RenderSession,
  records: readonly StyleOwnerRecord[],
) {
  for (const element of sheet.getStyleElement()) {
    const text = element.props?.dangerouslySetInnerHTML?.__html;
    if (text) styles.push(...ownedStyles(text, html, session, records));
  }
}

function styleSheet(
  root: StyledInstance,
  owner: string,
  records: StyleOwnerRecord[],
): StyledInstance {
  const proxy = Object.create(root) as StyledInstance;
  proxy.insertRules = (id, name, rules) => {
    records.push({ owner, css: rules.join("\n") });
    return root.insertRules(id, name, rules);
  };
  return proxy;
}

function emotionCache(
  root: EmotionCache,
  owner: string,
  records: StyleOwnerRecord[],
): EmotionCache {
  const proxy = Object.create(root) as EmotionCache;
  proxy.insert = (selector, serialized, sheet, shouldCache) => {
    records.push({ owner, css: serialized.styles });
    return root.insert(selector, serialized, sheet, shouldCache);
  };
  return proxy;
}
