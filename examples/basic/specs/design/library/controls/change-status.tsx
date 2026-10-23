import { defineComponent } from "@mokly/mokly";

import { libraryMetadata } from "../metadata.js";
import { changeStatus, enumOptions, type LibraryProps } from "../schemas.js";

import { ChangeStatusView } from "./change-status.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status"],
  properties: { status: changeStatus },
} as const;
export type ChangeStatusProps = LibraryProps<typeof propSchema>;
export const changeStatusBadge = defineComponent({
  ...libraryMetadata(
    "controls",
    "change-status",
    "Change status",
    "The change state of the selected catalogue entry.",
  ),
  propSchema,
  props: { status: "unmodified" },
  controls: {
    status: {
      kind: "select",
      label: "Status",
      options: enumOptions(changeStatus),
    },
  },
  render: ChangeStatusView,
  variants: changeStatus.enum.map((status) => ({
    slug: status,
    title: status[0]!.toUpperCase() + status.slice(1),
    props: { status },
  })),
});
