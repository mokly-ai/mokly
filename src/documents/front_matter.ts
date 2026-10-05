import { MoklyError } from "../errors.js";

/** The complete metadata grammar accepted at a document's first line. */
export interface DocumentFrontMatter {
  title?: string;
  description?: string;
  tags?: readonly string[];
  path?: string;
  movedFrom?: string;
}

/** Parse the deliberately small front matter grammar without YAML coercion. */
export function parseFrontMatter(
  source: string,
  location: string,
): { metadata: DocumentFrontMatter; body: string } {
  source = source.replace(/^\uFEFF/, "");
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  if (lines[0] !== "---") return { metadata: {}, body: source };
  const end = lines.indexOf("---", 1);
  const fail = (reason: string): never => {
    throw new MoklyError(
      "build-invalid",
      `${location}: front matter ${reason}`,
    );
  };
  if (end === -1) fail("block is not closed");
  const metadata: DocumentFrontMatter = {};
  const fields = new Set<string>();
  for (let index = 1; index < end; index++) {
    const line = /^([^:\s]+):[ \t]*(.*)$/.exec(lines[index]!);
    if (!line) fail(`line ${index + 1} is not "key: value"`);
    const name = line![1]!;
    if (!["title", "description", "tags", "path", "movedFrom"].includes(name))
      fail(`unknown field ${name}`);
    if (fields.has(name)) fail(`repeated field ${name}`);
    fields.add(name);
    const raw = line![2]!.trim();
    const reason = `${name} must be ${name === "tags" ? "an array of strings" : "a string"}`;
    let value: unknown = raw;
    if (/^["[{]/.test(raw)) {
      try {
        value = JSON.parse(raw);
      } catch {
        fail(reason);
      }
    }
    if (name === "tags") {
      if (
        !Array.isArray(value) ||
        !value.every((item) => typeof item === "string")
      )
        fail(reason);
      metadata.tags = value as string[];
    } else {
      if (typeof value !== "string") fail(reason);
      metadata[name as Exclude<keyof DocumentFrontMatter, "tags">] =
        value as string;
    }
  }
  return { metadata, body: lines.slice(end + 1).join("\n") };
}
