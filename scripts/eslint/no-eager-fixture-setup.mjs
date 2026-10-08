/** Require shared design fixtures to start setup lazily, never at module scope. */

/**
 * Function-like nodes that open a scope. Methods, constructors and accessors
 * are function expressions in ESTree; the TypeScript types are bodiless
 * overloads and declarations.
 */
const functionScopes =
  "ArrowFunctionExpression, FunctionDeclaration, FunctionExpression, TSDeclareFunction, TSEmptyBodyFunctionExpression";

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Start shared design fixture setup on first use, not at module scope.",
    },
    schema: [],
    messages: {
      eagerSetup: "Start shared setup through fileFixture on first use.",
    },
  },
  create(context) {
    let depth = 0;
    return {
      [functionScopes]() {
        depth += 1;
      },
      [`${functionScopes}:exit`]() {
        depth -= 1;
      },
      CallExpression(node) {
        if (
          depth === 0 &&
          node.callee.type === "Identifier" &&
          node.callee.name === "designLibraryFixture"
        )
          context.report({ node, messageId: "eagerSetup" });
      },
    };
  },
};
