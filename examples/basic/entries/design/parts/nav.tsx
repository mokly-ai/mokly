import {
  catalogueNavigation,
  type CatalogueNavigationProps,
} from "../library/chrome/catalogue-navigation.js";
import { optional, useDesignInstance } from "../library/composition.js";

import { useDesignNavigation } from "./design_navigation.js";
import type { DesignDestination } from "./destinations.js";
import { CHANGED_COUNT, NAV_TREE } from "./nav_data.js";

export type NavNode = CatalogueNavigationProps["rows"][number];
export type ChangesStatus = NonNullable<
  CatalogueNavigationProps["changesStatus"]
>;

interface NavTreeProps {
  changes?: boolean | undefined;
  activeDestination?: DesignDestination | undefined;
  activeLabel?: string | undefined;
  changedCount?: number | undefined;
  changedOnly?: boolean | undefined;
  changesStatus?: ChangesStatus | undefined;
  nodes?: readonly NavNode[] | undefined;
}

function CatalogueNavigation({
  activeDestination,
  changes = true,
  activeLabel,
  changedCount,
  changedOnly,
  changesStatus,
  nodes,
  drawer,
}: NavTreeProps & { drawer: boolean }) {
  const navigation = useDesignNavigation();
  return (
    <catalogueNavigation.Component
      moklyInstance={useDesignInstance("navigation")}
      rows={nodes ?? NAV_TREE}
      changedCount={changedCount ?? CHANGED_COUNT}
      showChanges={changes}
      changedOnly={changedOnly ?? false}
      presentation={drawer ? "drawer" : "responsive"}
      {...optional("changesStatus", changesStatus)}
      {...optional("activeDestination", activeDestination)}
      {...optional("activeLabel", activeLabel)}
      {...optional("allDestination", navigation.all)}
      {...optional("changesDestination", navigation.changes)}
    />
  );
}

export function NavTree(props: NavTreeProps) {
  return <CatalogueNavigation {...props} drawer={false} />;
}
export function NavDrawer(props: NavTreeProps) {
  return <CatalogueNavigation {...props} drawer />;
}
