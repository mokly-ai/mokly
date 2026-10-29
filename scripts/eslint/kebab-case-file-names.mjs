/** Require kebab-case file and directory names below a package root. */
import path from "node:path";

/** Lowercase letters and digits, in words that single hyphens join. */
const WORDS = "[a-z0-9]+(?:-[a-z0-9]+)*";
const DIRECTORY = new RegExp(`^${WORDS}$`, "u");
/** A kebab-case name, then its extension, such as `.tsx` or `.test.tsx`. */
const FILE = new RegExp(`^${WORDS}(?:\\.[a-z0-9]+)+$`, "u");

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require kebab-case file and directory names below a package root.",
    },
    schema: [
      {
        type: "object",
        properties: { root: { type: "string" } },
        required: ["root"],
        additionalProperties: false,
      },
    ],
    messages: {
      kebabCase:
        "Use a kebab-case name for {{name}}: lowercase letters and digits joined by single hyphens, then the extension, as in top-bar.tsx.",
    },
  },
  create(context) {
    const relative = path.relative(
      context.options[0].root,
      context.physicalFilename,
    );
    if (
      relative === "" ||
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    )
      return {};
    const directories = relative.split(path.sep);
    const file = directories.pop();
    const invalid = directories.filter((name) => !DIRECTORY.test(name));
    if (!FILE.test(file)) invalid.push(file);
    return {
      Program(node) {
        for (const name of invalid)
          context.report({ node, messageId: "kebabCase", data: { name } });
      },
    };
  },
};
