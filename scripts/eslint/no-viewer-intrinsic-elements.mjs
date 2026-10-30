// Each slice of plans/ui-package-shell-views.md removes its migrated files.
// The list started as the 53 files of the intrinsic-inventory.tsv baseline
// of milestone 2.
export const viewerIntrinsicExemptions = [
  "packages/viewer/src/shell/comparison_chrome.tsx",
  "packages/viewer/src/shell/comparison_frame.tsx",
  "packages/viewer/src/shell/comparison_side.tsx",
  "packages/viewer/src/shell/comparison_stack.tsx",
  "packages/viewer/src/shell/comparison_viewport.tsx",
  "packages/viewer/src/shell/comparison_views.tsx",
  "packages/viewer/src/shell/component_control_fields.tsx",
  "packages/viewer/src/shell/component_controls_panel.tsx",
  "packages/viewer/src/shell/details.tsx",
  "packages/viewer/src/shell/details_rows.tsx",
  "packages/viewer/src/shell/diffs.tsx",
  "packages/viewer/src/shell/document_stage_frame.tsx",
  "packages/viewer/src/shell/embedded_stage_overlay.tsx",
  "packages/viewer/src/shell/embedded_viewer.tsx",
  "packages/viewer/src/shell/evidence_details.tsx",
  "packages/viewer/src/shell/frames.tsx",
  "packages/viewer/src/shell/inspector.tsx",
  "packages/viewer/src/shell/page_evidence.tsx",
  "packages/viewer/src/shell/preview_frame.tsx",
  "packages/viewer/src/shell/preview_unavailable.tsx",
  "packages/viewer/src/shell/previews.tsx",
  "packages/viewer/src/shell/public_stage.tsx",
  "packages/viewer/src/shell/scheme_fallback.tsx",
  "packages/viewer/src/shell/stage_delivery.tsx",
  "packages/viewer/src/shell/stage_frame.tsx",
  "packages/viewer/src/shell/stages.tsx",
  "packages/viewer/src/shell/status_bar.tsx",
  "packages/viewer/src/shell/tags.tsx",
  "packages/viewer/src/shell/views.tsx",
  "packages/viewer/src/shell/workspace.tsx",
  "packages/viewer/src/shell/workspace_controls.tsx",
  "packages/viewer/src/shell/workspace_evidence.tsx",
  "packages/viewer/src/shell/workspace_inspection_labels.tsx",
  "packages/viewer/src/shell/workspace_instances.tsx",
  "packages/viewer/src/shell/workspace_props.tsx",
  "packages/viewer/src/shell/workspace_stage.tsx",
  "packages/viewer/src/shell/workspace_stylesheet_list.tsx",
  "packages/viewer/src/shell/workspace_usage.tsx",
  "packages/viewer/src/shell/workspace_variant_bar.tsx",
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
