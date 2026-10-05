import { defineComponent, type ComponentProps } from "@mokly/mokly";

import { libraryMetadata } from "../metadata.js";
import { changeStatus } from "../schemas.js";

import { ChangeStatusView } from "./change-status.view.js";

const propSchema = {
  kind: "object",
  properties: { status: changeStatus },
} as const;
export type ChangeStatusProps = ComponentProps<typeof propSchema, []>;
export const changeStatusBadge = defineComponent({
  ...libraryMetadata(
    "controls",
    "change-status",
    "Change status",
    "The change state of the selected catalogue entry.",
  ),
  propSchema,
  controls: {
    status: {
      kind: "select",
      label: "Status",
      options: changeStatus.schema.values.map((value) => ({
        label: value,
        value,
      })),
    },
  },
  render: ChangeStatusView,
  variants: (["unmodified", "added", "changed", "removed"] as const).map(
    (status) => ({
      slug: status,
      title: status[0]!.toUpperCase() + status.slice(1),
      props: { status },
    }),
  ),
});
