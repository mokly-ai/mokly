import type { Plugin, TransformCallback } from "postcss";

import { detail } from "./errors.js";

const receivers = new WeakMap<object, object>();

class PluginFailure extends Error {
  constructor(
    readonly plugin: string,
    cause: unknown,
  ) {
    super(detail(cause), { cause });
  }
}

function visitor(value: unknown, plugin: string, prepares = false): unknown {
  if (typeof value === "function") {
    return function (this: unknown, ...args: unknown[]) {
      try {
        const receiver =
          this && (typeof this === "object" || typeof this === "function")
            ? (receivers.get(this) ?? this)
            : this;
        const result: unknown = Reflect.apply(value, receiver, args);
        if (prepares) return visitor(result, plugin);
        if (result && typeof result === "object" && "then" in result)
          return Promise.resolve(result).catch((error: unknown) => {
            throw new PluginFailure(plugin, error);
          });
        return result;
      } catch (error) {
        throw new PluginFailure(plugin, error);
      }
    };
  }
  if (value && typeof value === "object") return visitors(value, plugin, false);
  return value;
}

function visitors(value: object, plugin: string, root: boolean): object {
  const proxy = new Proxy(
    { ...value },
    {
      get(_copy, key) {
        const member: unknown = Reflect.get(value, key, value);
        const hook =
          typeof key === "string" &&
          (key === "prepare" ||
            /^(Once|Root|Document|Rule|AtRule|Declaration|Comment)(Exit)?$/.test(
              key,
            ));
        return !root || hook
          ? visitor(member, plugin, key === "prepare")
          : member;
      },
      set(_copy, key, member: unknown) {
        return Reflect.set(value, key, member, value);
      },
    },
  );
  receivers.set(proxy, value);
  return proxy;
}

/** Preserve the plugin name for synchronous, asynchronous, and prepared visitors. */
export function attributed(
  plugin: Plugin | TransformCallback,
): Plugin | TransformCallback {
  const name =
    "postcssPlugin" in plugin ? plugin.postcssPlugin : plugin.name || "unknown";
  if (typeof plugin === "function")
    return visitor(plugin, name) as TransformCallback;
  return visitors(plugin, name, true) as Plugin;
}
