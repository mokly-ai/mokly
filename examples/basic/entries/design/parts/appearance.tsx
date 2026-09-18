import type { ReactNode } from "react";

/** The interface appearance an artboard depicts, independent of preview scheme. */
export type DesignAppearance = "light" | "dark";

/** The appearance selector setting a standalone catalogue can hold. */
export type AppearanceChoice = "auto" | "light" | "dark";

/**
 * Every artboard states the appearance it draws on its own root, so a generated
 * design page reads the same whatever appearance the browser showing it uses.
 * This is the one place that stamps it.
 */
export function DesignAppearanceScope({
  appearance,
  children,
}: {
  appearance: DesignAppearance;
  children: ReactNode;
}) {
  return (
    <div className="ce-design" data-mbk-appearance={appearance}>
      {children}
    </div>
  );
}
