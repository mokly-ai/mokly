import {
  catalogueNavigation,
  type CatalogueNavigationProps,
} from "../library/chrome/catalogue-navigation.js";
import { optional, useDesignInstance } from "../library/composition.js";

import { useDesignNavigation } from "./design_navigation.js";
import { CHANGED_COUNT } from "./nav_data.js";

export type NavNode = CatalogueNavigationProps["rows"][number];
export type ChangesStatus = NonNullable<
  CatalogueNavigationProps["changesStatus"]
>;

interface NavTreeProps {
  changes?: boolean | undefined;
  activeKey?: string | undefined;
  changedCount?: number | undefined;
  changedOnly?: boolean | undefined;
  changesStatus?: ChangesStatus | undefined;
  nodes: readonly NavNode[];
}

export function NavTree({
  activeKey,
  changes = true,
  changedCount,
  changedOnly,
  changesStatus,
  nodes,
}: NavTreeProps) {
  const navigation = useDesignNavigation();
  return (
    <catalogueNavigation.Component
      moklyInstance={useDesignInstance("navigation")}
      rows={nodes}
      changedCount={changedCount ?? CHANGED_COUNT}
      showChanges={changes}
      changedOnly={changedOnly ?? false}
      presentation="responsive"
      {...optional("changesStatus", changesStatus)}
      {...optional("activeKey", activeKey)}
      {...optional("allDestination", navigation.all)}
      {...optional("changesDestination", navigation.changes)}
    />
  );
}
