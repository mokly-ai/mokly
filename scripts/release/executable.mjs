import path from "node:path";

/** Windows npm shims need the Node entrypoint; do not pass paths through cmd.exe. */
export function executable(file, args, platform, node, npmPath) {
  if (file !== "npm" || platform !== "win32") return { file, args };
  if (!npmPath) throw new Error("could not resolve the npm CLI entrypoint");
  const cli = npmPath.endsWith(".js")
    ? npmPath
    : path.win32.join(
        path.win32.dirname(npmPath),
        "node_modules/npm/bin/npm-cli.js",
      );
  return { file: node, args: [cli, ...args] };
}
