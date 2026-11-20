import { createBadgeStyles } from "@firna/ui/badge";
import { buttonHeight } from "@firna/ui/button";
import { SkeletonBar } from "@firna/ui/skeleton";
import { useSharedUiTheme } from "@firna/ui/theme";

import { touchTarget } from "../../../components/button";
import { useMockupRenderContext } from "../../../render-context";
import { ControlPlaceholder } from "../placeholders";

/**
 * The placeholder forms of two parts that a settings pane's rows draw while
 * their list is read: a row's three-dot trigger and a row's status badge. The
 * Account pane's GitHub note draws the badge's form too, while the session is
 * read. Each keeps the box that its part draws, read from the package's own
 * scale, so a waiting row and a loaded row keep one height.
 */

/**
 * A row's three-dot trigger, whose name the answer supplies: a placeholder in
 * the trigger's square box, which is the package's compact control on a
 * pointer viewport and the touch target on a touch one, as the registered
 * menu draws it.
 */
export function MenuTriggerPlaceholder() {
  const { viewport } = useMockupRenderContext();
  const side =
    viewport === "mobile"
      ? Math.max(buttonHeight("sm"), touchTarget)
      : buttonHeight("sm");
  return <ControlPlaceholder size="sm" width={side} />;
}

/**
 * A status badge, whose label the answer supplies: a placeholder pill of the
 * badge's own height at the density the registered badge draws, `width` px
 * wide, the width of the badge that it stands for in its most common form.
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
