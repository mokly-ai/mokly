// The viewer files whose markup has not moved to @mokly/ui yet. Every viewer
// file composes package components now, so the list is empty.
export const viewerIntrinsicExemptions = [];

/** Keep the viewer as containers that render package components. */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Render UI package components instead of intrinsic JSX elements in the viewer.",
    },
    schema: [],
    messages: {
      intrinsic:
        "Render a @mokly/ui component instead of the intrinsic <{{name}}> element.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (
          node.name.type === "JSXIdentifier" &&
          /^[a-z]/u.test(node.name.name)
        )
          context.report({
            node,
            messageId: "intrinsic",
            data: { name: node.name.name },
          });
      },
    };
  },
};
