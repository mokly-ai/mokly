import * as esbuild from "esbuild";
import type {
  BuildContext,
  BuildOptions,
  BuildResult,
  Plugin,
  PluginBuild,
} from "esbuild";

/** One hook registration without its callback, as the kept context compiled it. */
interface HookShape {
  readonly plugin: number;
  readonly filter?: string | undefined;
  readonly flags?: string | undefined;
  readonly namespace?: string | undefined;
}

type Hook = HookShape &
  (
    | {
        readonly kind: "start";
        readonly callback: Parameters<PluginBuild["onStart"]>[0];
      }
    | {
        readonly kind: "end";
        readonly callback: Parameters<PluginBuild["onEnd"]>[0];
      }
    | {
        readonly kind: "resolve";
        readonly callback: Parameters<PluginBuild["onResolve"]>[1];
      }
    | {
        readonly kind: "load";
        readonly callback: Parameters<PluginBuild["onLoad"]>[1];
      }
    | {
        readonly kind: "dispose";
        readonly callback: Parameters<PluginBuild["onDispose"]>[0];
      }
  );

/** Creates an esbuild build context; esbuild's own `context` outside tests. */
export type CreateContext = (options: BuildOptions) => Promise<BuildContext>;

/**
 * One esbuild build context that a sidecar process keeps for its guarded
 * attempts. A compile with equal build options and an equal hook list rebuilds
 * it, so esbuild reuses its parse of unchanged files. Any other compile
 * replaces it, and a failed compile disposes of it. Each rebuild runs the hooks
 * of the current request, and no request state stays after its rebuild.
 * Calls must not overlap; a sidecar process serves one request at a time.
 */
export class KeptContext {
  /** The hooks of the rebuild that runs now; empty between rebuilds. */
  private hooks: readonly Hook[] = [];
  /** The plugin builds of the context, by plugin position, for `resolve`. */
  private readonly builds: PluginBuild[] = [];
  private context: BuildContext | undefined;
  private key: string | undefined;

  constructor(private readonly create: CreateContext = esbuild.context) {}

  /** Rebuild or replace the context for `options`; the result has the shape of `options`. */
  async compile<T extends BuildOptions>(options: T): Promise<BuildResult<T>> {
    const { plugins = [], ...settings }: BuildOptions = options;
    const hooks: Hook[] = [];
    for (const [index, plugin] of plugins.entries())
      await plugin.setup(
        recorder(index, hooks, () => this.builds[index], options),
      );
    const names = plugins.map((plugin) => plugin.name);
    const shapes = hooks.map(shape);
    const key = JSON.stringify([settings, names, shapes]);
    if (key !== this.key || !this.context) {
      await this.dispose();
      this.context = await this.create({
        ...settings,
        plugins: delegates(
          names,
          shapes,
          (position) => this.hooks[position],
          (index, build) => {
            this.builds[index] = build;
          },
        ),
      });
      this.key = key;
    }
    this.hooks = hooks;
    try {
      // The context was created from settings equal to these options, so the shapes agree.
      return (await this.context.rebuild()) as BuildResult<T>;
    } catch (error) {
      await this.dispose();
      throw error;
    } finally {
      this.hooks = [];
      for (const hook of hooks) if (hook.kind === "dispose") hook.callback();
    }
  }

  /** Dispose of the context, if any; the next compile creates a new one. */
  async dispose(): Promise<void> {
    const context = this.context;
    this.context = undefined;
    this.key = undefined;
    this.builds.length = 0;
    // A failed dispose leaves nothing to release: its service has ended.
    await context?.dispose().catch(() => undefined);
  }
}

/** The part of a hook that the context compiles: everything but its callback. */
function shape({ plugin, kind, filter, flags, namespace }: Hook) {
  return { plugin, kind, filter, flags, namespace };
}

/** The build object that one request plugin sets up against; it records each hook. */
function recorder(
  index: number,
  hooks: Hook[],
  contextBuild: () => PluginBuild | undefined,
  initialOptions: BuildOptions,
): PluginBuild {
  const filtered = (settings: { filter: RegExp; namespace?: string }) => ({
    plugin: index,
    filter: settings.filter.source,
    flags: settings.filter.flags,
    namespace: settings.namespace,
  });
  return {
    initialOptions,
    esbuild,
    resolve: (path, settings) => {
      const build = contextBuild();
      if (!build)
        throw new Error("the kept context resolves only during a rebuild");
      return build.resolve(path, settings);
    },
    onStart: (callback) =>
      hooks.push({ plugin: index, kind: "start", callback }),
    onEnd: (callback) => hooks.push({ plugin: index, kind: "end", callback }),
    onDispose: (callback) =>
      hooks.push({ plugin: index, kind: "dispose", callback }),
    onResolve: (settings, callback) =>
      hooks.push({ ...filtered(settings), kind: "resolve", callback }),
    onLoad: (settings, callback) =>
      hooks.push({ ...filtered(settings), kind: "load", callback }),
  };
}

/** Context plugins that hold hook shapes only and forward each hook to the current request. */
function delegates(
  names: readonly string[],
  shapes: readonly ReturnType<typeof shape>[],
  hook: (position: number) => Hook | undefined,
  register: (index: number, build: PluginBuild) => void,
): Plugin[] {
  return names.map((name, index) => ({
    name,
    setup(build) {
      register(index, build);
      shapes.forEach((shaped, position) => {
        if (shaped.plugin !== index) return;
        const current = () => hook(position);
        const options = {
          filter: new RegExp(shaped.filter ?? "", shaped.flags),
          ...(shaped.namespace === undefined
            ? {}
            : { namespace: shaped.namespace }),
        };
        if (shaped.kind === "start")
          build.onStart(() => {
            const active = current();
            return active?.kind === "start" ? active.callback() : undefined;
          });
        else if (shaped.kind === "end")
          build.onEnd((result) => {
            const active = current();
            return active?.kind === "end" ? active.callback(result) : undefined;
          });
        else if (shaped.kind === "resolve")
          build.onResolve(options, (args) => {
            const active = current();
            return active?.kind === "resolve"
              ? active.callback(args)
              : undefined;
          });
        else if (shaped.kind === "load")
          build.onLoad(options, (args) => {
            const active = current();
            return active?.kind === "load" ? active.callback(args) : undefined;
          });
      });
    },
  }));
}
