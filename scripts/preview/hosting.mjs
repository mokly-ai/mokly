import fs from "node:fs/promises";
import path from "node:path";

/** Add host policy to a separate deployment copy; the installed artifact stays intact. */
export async function prepareHosting(source, destination) {
  const input = path.resolve(source);
  const output = path.resolve(destination);
  if (input === output || output.startsWith(`${input}${path.sep}`))
    throw new Error("The deployment copy must be outside the built output.");
  await fs.cp(input, output, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  await fs.writeFile(
    path.join(output, "_headers"),
    "/*\n  Cache-Control: no-cache\n  X-Content-Type-Options: nosniff\n\n/*.json\n  ! Content-Type\n  Content-Type: application/json; charset=utf-8\n\n/mokly-viewer/diffs/generations/*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable\n",
    { flag: "wx" },
  );
}

if (process.argv[1] === import.meta.filename) {
  const [source, destination] = process.argv.slice(2);
  if (!source || !destination)
    throw new Error("Usage: hosting.mjs source destination");
  await prepareHosting(source, destination);
}
