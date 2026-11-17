import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

import { IconSvg } from "../../../../../../packages/ui/src/icons/icons.js";

/** A stroked panel with its left column, on the shell icons' 24-unit grid. */
function PanelLeftIcon() {
  return (
    <IconSvg size={14}>
      <rect height={18} rx={2} width={18} x={3} y={3} />
      <path d="M9 3v18" />
    </IconSvg>
  );
}

/**
 * The button at the end of the column head. It hides the column on a wide
 * window, and the drawer of a hidden column shows it again. A static artboard
 * runs no script, so the button is a link to the artboard that shows the
 * outcome, or a picture of itself that acts on nothing.
 */
export function ColumnToggle({
  hidden,
  href,
}: {
  /** Whether the reader hid the column, so the button shows it again. */
  hidden: boolean;
  href: string | undefined;
}) {
  const name = hidden
    ? "Show catalogue navigation"
    : "Hide catalogue navigation";
  return href === undefined ? (
    <span aria-label={name} className="mbk-nav-toggle mbk-reset" role="img">
      <PanelLeftIcon />
    </span>
  ) : (
    <a
      aria-label={name}
      className="mbk-nav-toggle mbk-reset"
      href={href}
      title={name}
    >
      <PanelLeftIcon />
    </a>
  );
}

interface ParentProps {
  children?: ReactNode;
  className?: string;
}

/**
 * The column with one more control at the end of its head. `@mokly/ui` draws
 * no hide button yet, so the mockup adds the button to the head of the column
 * that the package component returns, and keeps the rest of its markup.
 */
export function withHeadEnd(
  column: ReactElement<ParentProps>,
  end: ReactNode,
): ReactElement {
  const [head, ...rest] = Children.toArray(column.props.children);
  if (
    !isValidElement<ParentProps>(head) ||
    !head.props.className?.split(" ").includes("mbk-nav-head")
  )
    throw new Error("The catalogue navigation draws no column head");
  return cloneElement(
    column,
    undefined,
    cloneElement(
      head,
      undefined,
      ...Children.toArray(head.props.children),
      end,
    ),
    ...rest,
  );
}
