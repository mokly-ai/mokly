/** Read regular files without following links inside a retained artifact root. */
import fs from "node:fs";
import path from "node:path";

export function readConfinedFile(
  directory: string,
  relative: string,
): Buffer | undefined {
  const root = path.resolve(directory);
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) return undefined;
  let descriptor: number | undefined;
  try {
    const ancestors = [root];
    let parent = root;
    for (const segment of path
      .relative(root, file)
      .split(path.sep)
      .slice(0, -1)) {
      parent = path.join(parent, segment);
      ancestors.push(parent);
    }
    const directories = ancestors.map((candidate) => fs.lstatSync(candidate));
    if (directories.some((stat) => !stat.isDirectory())) return undefined;
    const leaf = fs.lstatSync(file);
    if (!leaf.isFile()) return undefined;
    descriptor = fs.openSync(
      file,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK,
    );
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.dev !== leaf.dev || opened.ino !== leaf.ino)
      return undefined;
    const content = fs.readFileSync(descriptor);
    if (
      ancestors.some((candidate, index) => {
        const current = fs.lstatSync(candidate);
        const previous = directories[index]!;
        return (
          !current.isDirectory() ||
          current.dev !== previous.dev ||
          current.ino !== previous.ino
        );
      })
    )
      return undefined;
    return content;
  } catch {
    return undefined;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}
