import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

export function context(file: string) {
  const native = createRequire(file);
  const target = (name: string) =>
    name.startsWith("file:") ? fileURLToPath(name) : name;
  const require = Object.assign(
    (name: string) => native(target(name)),
    native,
    {
      resolve: Object.assign(
        (name: string, options?: { paths?: string[] }) =>
          native.resolve(target(name), options),
        native.resolve,
      ),
    },
  );
  return {
    require,
    import(value: unknown, options?: ImportCallOptions) {
      const name = String(value);
      const resolved = /^(node|data|file):/.test(name)
        ? name
        : pathToFileURL(native.resolve(name)).href;
      return import(resolved, options);
    },
  };
}
