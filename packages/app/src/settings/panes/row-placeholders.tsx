import { createBadgeStyles } from "@firna/ui/badge";
import { buttonHeight } from "@firna/ui/button";
import { SkeletonBar } from "@firna/ui/skeleton";
import { useSharedUiTheme } from "@firna/ui/theme";

import { touchTarget } from "../../components/action";
import { ControlPlaceholder } from "../../components/placeholders";
import { useCompact } from "../../layout/viewport";

/**
 * The placeholder forms of two parts that a settings pane's rows draw while
 * their list is read, the same forms the catalogue draws from its own
 * `settings/row-placeholders.tsx`: a row's three-dot trigger and a row's
 * status badge. The Account pane's GitHub note draws the badge's form too,
 * while the session is read. Each keeps the box that its part draws, read
 * from the package's own scale, so a waiting row and a loaded row keep one
 * height.
 */

/**
 * A row's three-dot trigger, or another compact icon-only control such as the
 * projects panel's Workspace settings cog, whose presence the answer decides:
 * a placeholder in the control's square box, the package's compact control under a pointer and
 * the touch target on a compact surface, as `RowMenu` draws it.
 */
export function MenuTriggerPlaceholder() {
  const side = useCompact()
    ? Math.max(buttonHeight("sm"), touchTarget)
    : buttonHeight("sm");
  return <ControlPlaceholder size="sm" width={side} />;
}

/**
 * A status badge, whose label the answer supplies: a placeholder pill of the
 * badge's own height at the density `StatusBadge` draws, `width` px wide, the
 * width of the badge that it stands for in its most common form.
 */
export function BadgePlaceholder({ width = 64 }: { width?: number }) {
  const { badge, label } = createBadgeStyles(useSharedUiTheme(), "md");
  return (
    <div className="fo-wait-control" aria-hidden="true">
      <SkeletonBar
        width={width}
        height={label.lineHeight + 2 * badge.paddingVertical}
        radius={badge.borderRadius}
      />
    </div>
  );
}
