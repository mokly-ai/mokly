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
const ArtboardContext = createContext<DesignDestination | undefined>(undefined);

/** A rendered artboard explicitly selects its own navigation contract. */
export function DesignNavigation({
  children,
  design,
}: {
  children: ReactNode;
  design: DesignDestination;
}) {
  return (
    <ArtboardContext value={design}>
      <NavigationContext value={NAVIGATION_STATES[design]}>
        {children}
      </NavigationContext>
    </ArtboardContext>
  );
}

export function useDesignNavigation(): NavigationState {
  return useContext(NavigationContext);
}

/**
 * Marks a link to the artboard that renders it, such as the selected region
 * or an action already in effect, as the current page.
 */
export function useCurrentPage(): (to: string) => "page" | undefined {
  const artboard = useContext(ArtboardContext);
  return (to) => (to === artboard ? "page" : undefined);
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
