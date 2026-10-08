/** Require the shared builders for comparison artifact paths in production code. */

/** A snapshot path, or `pages/` followed later by `.json`. */
const artifactPath = /snapshots\/|pages\/[\s\S]*\.json/u;

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Use the shared builders for comparison artifact paths.",
    },
    schema: [],
    messages: {
      artifactPath:
        "Build comparison artifact paths with the shared builders in packages/viewer/src/navigation/routes.ts instead of spelling snapshot paths or pages/…json.",
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value === "string" && artifactPath.test(node.value))
          context.report({ node, messageId: "artifactPath" });
      },
      TemplateLiteral(node) {
        const text = node.quasis.map((quasi) => quasi.value.raw).join("${}");
        if (artifactPath.test(text))
          context.report({ node, messageId: "artifactPath" });
      },
    };
  },
};
