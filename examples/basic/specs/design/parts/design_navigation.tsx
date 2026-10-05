import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";

import { MockLink } from "@mokly/mokly";

import type { DesignDestination } from "./destinations.js";
import {
  NAVIGATION_STATES,
  type NavigationState,
} from "./navigation_states.js";

const NavigationContext = createContext<NavigationState>({});

/** A rendered artboard explicitly selects its own navigation contract. */
export function DesignNavigation({
  children,
  design,
}: {
  children: ReactNode;
  design: DesignDestination;
}) {
  return (
    <NavigationContext value={NAVIGATION_STATES[design]}>
      {children}
    </NavigationContext>
  );
}

export function useDesignNavigation(): NavigationState {
  return useContext(NavigationContext);
}

/** A missing destination preserves the non-interactive child exactly. */
export function DesignLink({
  children,
  to,
}: {
  children: ReactElement;
  to: DesignDestination | undefined;
}) {
  return to === undefined ? (
    children
  ) : (
    <MockLink asChild to={to}>
      {children}
    </MockLink>
  );
}
