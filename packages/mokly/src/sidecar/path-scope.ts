import path from "node:path";

export function logical(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}

export function inside(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}
