import path from "node:path";

export function logical(root: string, file: string): string {
  if (path.sep === "/" && normalized(root) && normalized(file)) {
    if (root === "/") return file.slice(1);
    if (root === file) return "";
    if (file.startsWith(`${root}/`)) return file.slice(root.length + 1);
  }
  return path.relative(root, file).split(path.sep).join("/");
}

export function inside(root: string, file: string): boolean {
  if (path.sep === "/" && normalized(root) && normalized(file))
    return root === "/" || root === file || file.startsWith(`${root}/`);
  const relative = path.relative(root, file);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

export function repositoryOwned(
  sourceRoot: string,
  dependencyRoots: readonly string[],
  file: string,
): boolean {
  return (
    inside(sourceRoot, file) &&
    !dependencyRoots.some((root) => inside(root, file)) &&
    !logical(sourceRoot, file).split("/").includes("node_modules")
  );
}

function normalized(file: string): boolean {
  return (
    file.startsWith("/") &&
    (file === "/" ||
      (!file.endsWith("/") && !/\/(?:\/|\.\.?(?:\/|$))/.test(file)))
  );
}
