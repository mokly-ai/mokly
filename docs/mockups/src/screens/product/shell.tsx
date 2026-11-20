import type { ReactNode } from "react";

/** The slot positions the hosted viewer's top bar fills above its stage. */
const slots = ["lead", "middle", "trail"] as const;

/**
 * The cloud fallback around loading, empty and unavailable stage cards. Ready
 * viewer screens render the published package instead.
 *
 * With no `bar` the slots stay empty and reserve their proportions, which is
 * the stage the settings dialog opens over: it carries no landmark, heading or
 * content, so the dialog keeps the document's single main landmark and primary
 * heading and the page beneath stays inert.
 */
export function ViewerStage({
  bar,
  children,
}: {
  bar?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="fo-stage">
      {bar ?? (
        <div className="fo-stage-bar">
          {slots.map((slot) => (
            <span
              className={"fo-stage-slot fo-stage-slot-" + slot}
              key={slot}
            />
          ))}
        </div>
      )}
      <div className="fo-stage-canvas">{children}</div>
    </div>
  );
}
