import type { DevEnvironment, Rollup } from "vite";

type ResolveOptions = Parameters<Rollup.PluginContext["resolve"]>[2];
type CustomOptions = NonNullable<ResolveOptions>["custom"];

interface ResolveRequest {
  source: string;
  target: string;
  candidate: string;
  importer: string | undefined;
}

export type ViteResolve = (
  request: ResolveRequest,
) => Promise<Rollup.PartialResolvedId | null>;

interface DelegatedRequest extends ResolveRequest {
  kind: NonNullable<ResolveOptions>["kind"];
}

const delegated = new WeakMap<object, DelegatedRequest>();
const kindForwarding = new WeakSet<DevEnvironment["pluginContainer"]>();

function delegatedRequest(
  source: string,
  importer: string | undefined,
  custom: CustomOptions,
): DelegatedRequest | undefined {
  const request = custom && delegated.get(custom);
  if (
    request &&
    importer === request.candidate &&
    (source === request.source || source === request.target)
  )
    return request;
}

/** An alias can forward the same request with its replacement as the id. */
export function delegatedViteResolve(
  source: string,
  importer: string | undefined,
  custom: CustomOptions,
): boolean {
  return delegatedRequest(source, importer, custom) !== undefined;
}

function resolveOptions(request: ResolveRequest, incoming?: ResolveOptions) {
  const prior: unknown = incoming?.custom?.mokly;
  const mokly = prior && typeof prior === "object" ? prior : {};
  const importer =
    "importer" in mokly && typeof mokly.importer === "string"
      ? mokly.importer
      : request.importer;
  const custom = { ...incoming?.custom, mokly: { ...mokly, importer } };
  delegated.set(custom, { ...request, kind: incoming?.kind });
  return { ...incoming, custom };
}

/** Keep Vite's active skip history when a plugin starts the lookup. */
export function viteHookResolver(
  context: Pick<Rollup.PluginContext, "resolve" | "environment">,
  options: ResolveOptions,
): ViteResolve {
  if (options?.kind !== undefined && context.environment.mode === "dev")
    forwardResolveKind(context.environment);
  return (request) =>
    context.resolve(
      request.source,
      request.candidate,
      resolveOptions(request, options),
    );
}

/** Vite 8's dev context drops kind when it forwards to the container. */
function forwardResolveKind(environment: DevEnvironment): void {
  const container = environment.pluginContainer;
  if (kindForwarding.has(container)) return;
  kindForwarding.add(container);
  const resolveId = container.resolveId.bind(container);
  container.resolveId = (source, importer, options) => {
    const kind = delegatedRequest(source, importer, options?.custom)?.kind;
    return resolveId(
      source,
      importer,
      kind !== undefined && options?.kind === undefined
        ? { ...options, kind }
        : options,
    );
  };
}

/** Only skip the first hook for this call. Nested requests have their own ids. */
export function viteContainerResolver(
  environment: DevEnvironment,
): ViteResolve {
  const first = environment.plugins.find(({ name }) => name === "mokly-first");
  return (request) =>
    environment.pluginContainer.resolveId(request.source, request.candidate, {
      custom: resolveOptions(request).custom,
      skipCalls: first
        ? [{ id: request.source, importer: request.candidate, plugin: first }]
        : [],
    });
}
