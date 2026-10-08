/** Require cleanup that depends on a shared fixture to register with it. */

const fixtureHelpers = new Set([
  "changedFixture",
  "componentReviewFixture",
  "designLibraryFixture",
]);

/**
 * Function-like nodes that open a scope. Methods, constructors and accessors
 * are function expressions in ESTree; the TypeScript types are bodiless
 * overloads and declarations.
 */
const functionScopes =
  "ArrowFunctionExpression, FunctionDeclaration, FunctionExpression, TSDeclareFunction, TSEmptyBodyFunctionExpression";

/** Whether a call registers a test-runner teardown hook, as `t.after()` does. */
function isTeardownHook(node) {
  return (
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "after"
  );
}

/** Identify the cleanup owner passed to a fileFixture setup callback. */
function fixtureOwner(node) {
  const call = node.parent;
  if (
    call?.type !== "CallExpression" ||
    call.callee.type !== "Identifier" ||
    call.callee.name !== "fileFixture" ||
    call.arguments[0] !== node ||
    node.params[0]?.type !== "Identifier"
  )
    return undefined;
  return node.params[0].name;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Register dependent cleanup with the fixture instead of a later test hook.",
    },
    schema: [],
    messages: {
      lateTeardown:
        "Register dependent cleanup with fixture.beforeRemove(), not a later test hook.",
    },
  },
  create(context) {
    const scopes = [];
    function enter(node) {
      scopes.push({ fixtureStarts: [], hooks: [], owner: fixtureOwner(node) });
    }
    function exit() {
      const { fixtureStarts, hooks } = scopes.pop();
      if (fixtureStarts.length === 0) return;
      const firstFixture = Math.min(...fixtureStarts);
      for (const hook of hooks)
        if (hook.range[0] >= firstFixture)
          context.report({ node: hook, messageId: "lateTeardown" });
    }

    return {
      Program: enter,
      "Program:exit": exit,
      [functionScopes]: enter,
      [`${functionScopes}:exit`]: exit,
      CallExpression(node) {
        const scope = scopes.at(-1);
        if (
          node.callee.type === "Identifier" &&
          fixtureHelpers.has(node.callee.name)
        )
          scope.fixtureStarts.push(node.range[0]);
        else if (isTeardownHook(node)) {
          const object = node.callee.object;
          if (object.type !== "Identifier" || object.name !== scope.owner)
            scope.hooks.push(node);
        }
      },
    };
  },
};
