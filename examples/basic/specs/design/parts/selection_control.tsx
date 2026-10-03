import { DesignLink } from "./design_navigation.js";
import type { DesignDestination } from "./destinations.js";

/** Linked transitions keep anchor semantics; depicted buttons expose selection. */
export function SelectionControl({
  accessible = false,
  active,
  label,
  to,
}: {
  accessible?: boolean | undefined;
  active: boolean;
  label: string;
  to?: DesignDestination | undefined;
}) {
  const button = accessible && to === undefined;
  const Control = button ? "button" : "span";
  return (
    <DesignLink to={to}>
      <Control
        type={button ? "button" : undefined}
        aria-pressed={button ? active : undefined}
        className={active ? "active" : undefined}
      >
        {label}
      </Control>
    </DesignLink>
  );
}
