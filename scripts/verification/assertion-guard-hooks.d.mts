interface ResolveContext {
  parentURL?: string | undefined;
}
interface ResolveResult {
  url: string;
  shortCircuit?: boolean;
}
interface LoadContext {
  format?: string;
}
interface LoadResult {
  format: string;
  source?: string;
  shortCircuit?: boolean;
}

/** Set the URL of the guard-owned repository root. */
export function initialize(data: { root: string }): void;

/** Resolve repository-owned assertion imports. */
export function resolve(
  specifier: string,
  context: ResolveContext,
  nextResolve: (
    specifier: string,
    context: ResolveContext,
  ) => Promise<ResolveResult>,
): Promise<ResolveResult>;

/** Load counting modules with the running Node release's export surface. */
export function load(
  url: string,
  context: LoadContext,
  nextLoad: (url: string, context: LoadContext) => Promise<LoadResult>,
): Promise<LoadResult>;
