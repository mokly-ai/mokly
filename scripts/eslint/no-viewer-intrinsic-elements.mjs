// Each slice of plans/ui-package-shell-views.md removes its migrated files.
// The list started as the 53 files of the intrinsic-inventory.tsv baseline
// of milestone 2.
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
