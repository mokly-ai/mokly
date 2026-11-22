import { mockLink } from "@mokly/mokly";

import { ScreenHeader } from "../../../../../../packages/ui/src/screen-header/screen-header.js";
import { changeStatusBadge } from "../controls/change-status.js";

import type { ScreenHeaderProps } from "./screen-header.js";

/**
 * The shipped screen header. A static artboard runs no script, so a crumb
 * with a destination links to its artboard, and the path chip is a picture
 * of itself.
 */
export function ScreenHeaderView({
  title,
  crumbs,
  path,
  status,
  actions,
}: ScreenHeaderProps) {
  return (
    <ScreenHeader
      action={actions}
      crumbs={crumbs.map((crumb) =>
        crumb.destination === undefined
          ? { label: crumb.label }
          : { href: mockLink(crumb.destination), label: crumb.label },
      )}
      heading={title}
      interactive={false}
      path={path}
      status={
        status ? <changeStatusBadge.Component status={status} /> : undefined
      }
    />
  );
}
