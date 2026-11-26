import { AsyncLocalStorage } from "node:async_hooks";
import nodeModule from "node:module";
import { pathToFileURL } from "node:url";

import { recordModulePath } from "./postcss-evidence.js";

interface RequestScope {
  jsonUrl?: string;
  importRequest?: ModuleRequest;
}

interface ModuleRequest {
  name: string;
  url?: string;
}

const scopeKey = Symbol.for("mokly.postcss.requestScope");
const scope =
  (Reflect.get(globalThis, scopeKey) as
    AsyncLocalStorage<RequestScope> | undefined) ??
  new AsyncLocalStorage<RequestScope>();
let installed = false;
let activeRequire: ModuleRequest | undefined;

/** Follow loads started by PostCSS through awaited plugin work. */
export function postcssRequest<T>(load: () => T): T {
  return scope.run({}, load);
}

/** Mokly's JSON load uses the request form already recorded by its caller. */
export function ownJsonRequire<T>(file: string, load: () => T): T {
  return scope.run({ jsonUrl: pathToFileURL(file).href }, load);
}

/** Record a successful import even when Node already holds its module. */
export async function postcssNativeImport<T>(
  name: string,
  load: () => Promise<T>,
): Promise<T> {
  const request: ModuleRequest = { name };
  const result = await scope.run({ importRequest: request }, load);
  recordModulePath(request.url ?? name, true);
  return result;
}

function recordLoad(url: string): void {
  const request = scope.getStore();
  recordModulePath(url, request !== undefined && request.jsonUrl !== url);
}

function observeNativeRequires(): void {
  const previousPaths = new WeakMap<NodeJS.Module, Map<string, string>>();
  const require = nodeModule.prototype.require;
  nodeModule.prototype.require = function (
    this: NodeJS.Module,
    name: string,
  ): unknown {
    const parent = activeRequire;
    const request: ModuleRequest = { name };
    const childCount = this.children.length;
    activeRequire = request;
    try {
      const result: unknown = Reflect.apply(require, this, [name]);
      const child = this.children[childCount];
      const url = child?.filename
        ? pathToFileURL(child.filename).href
        : (request.url ?? previousPaths.get(this)?.get(name));
      if (url) {
        let paths = previousPaths.get(this);
        if (!paths) previousPaths.set(this, (paths = new Map()));
        paths.set(name, url);
        recordLoad(url);
      }
      return result;
    } finally {
      activeRequire = parent;
    }
  };
}

/**
 * Keep path observation outside consumer hooks without witnessing their bytes.
 * The resolve hook installs itself again after each `registerHooks` call, so it
 * stays outside every consumer hook. Synchronous hooks also wrap asynchronous
 * loaders, so it reports the modules that those loaders supply, and Mokly
 * registers no asynchronous hook of its own.
 */
export function observeModulePaths(): void {
  if (installed) return;
  installed = true;
  Object.defineProperty(globalThis, scopeKey, { value: scope });
  observeNativeRequires();
  if (typeof nodeModule.registerHooks !== "function") return;
  const register = nodeModule.registerHooks;
  let observer: ReturnType<typeof register> | undefined;
  const install = () => {
    observer?.deregister();
    observer = register({
      resolve(specifier, context, nextResolve) {
        const result = nextResolve(specifier, context);
        if (activeRequire?.name === specifier) activeRequire.url = result.url;
        const imported = scope.getStore()?.importRequest;
        if (imported?.name === specifier) imported.url ??= result.url;
        recordModulePath(result.url);
        return result;
      },
      load(url, context, nextLoad) {
        const result = nextLoad(url, context);
        recordLoad(url);
        return result;
      },
    });
  };
  Object.defineProperty(nodeModule, "registerHooks", {
    value: (options: Parameters<typeof register>[0]) => {
      const hooks = register(options);
      install();
      return hooks;
    },
  });
  install();
  nodeModule.syncBuiltinESMExports();
}
