/** Require shared constants for Mokly-owned directory names in production code. */

const directories = [
  { name: "mokly-generated", messageId: "generated" },
  { name: "mokly-viewer", messageId: "viewer" },
];

/** Decode character escapes once, leaving regex operators and classes intact. */
function regexLiteralCharacters(pattern) {
  return pattern.replace(
    /\\(?:x([\dA-Fa-f]{2})|u([\dA-Fa-f]{4})|u\{([\dA-Fa-f]+)\}|([^A-Za-z0-9\s]))/g,
    (escape, byte, unit, point, punctuation) => {
      if (punctuation !== undefined) return punctuation;
      const value = Number.parseInt(byte ?? unit ?? point, 16);
      return value <= 0x10ffff ? String.fromCodePoint(value) : escape;
    },
  );
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Use shared constants for Mokly-owned directory names.",
    },
    schema: [],
    messages: {
      viewer:
        "Import VIEWER_DIRECTORY instead of spelling the viewer directory.",
      generated:
        "Import GENERATED_DIRECTORY instead of spelling the output directory.",
    },
  },
  create(context) {
    function check(node, values) {
      for (const { name, messageId } of directories) {
        if (values.some((value) => value?.includes(name)))
          context.report({ node, messageId });
      }
    }

    return {
      Literal(node) {
        if (node.regex) {
          check(node, [
            node.regex.pattern,
            regexLiteralCharacters(node.regex.pattern),
          ]);
        } else if (typeof node.value === "string") {
          check(node, [node.value, node.raw]);
        }
      },
      TemplateElement(node) {
        check(node, [node.value.cooked, node.value.raw]);
      },
    };
  },
};
