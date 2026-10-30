// Each slice of plans/ui-package-shell-views.md removes its migrated files.
// The list started as the 53 files of the intrinsic-inventory.tsv baseline
// of milestone 2.
export const viewerIntrinsicExemptions = [
  "packages/viewer/src/shell/embedded_stage_overlay.tsx",
  "packages/viewer/src/shell/embedded_viewer.tsx",
  "packages/viewer/src/shell/views.tsx",
  "packages/viewer/src/shell/workspace.tsx",
  "packages/viewer/src/shell/workspace_inspection_labels.tsx",
  "packages/viewer/src/standalone/shell.tsx",
  "packages/viewer/src/standalone/version_failure.tsx",
  "packages/viewer/src/viewer/component.tsx",
  "packages/viewer/src/viewer/host_bridge.tsx",
  "packages/viewer/src/viewer/inspection_layer.tsx",
  "packages/viewer/src/viewer/marker_layer.tsx",
  "packages/viewer/src/viewer/ready.tsx",
];

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
