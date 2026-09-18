import { createContext, useContext, type ReactNode } from "react";

/** The interface appearance an artboard depicts, independent of preview scheme. */
export type DesignAppearance = "light" | "dark";

/** The appearance selector setting a standalone catalogue can hold. */
export type AppearanceChoice = "auto" | "light" | "dark";

const AppearanceContext = createContext<DesignAppearance>("light");

/**
 * Every artboard states the appearance it draws, so a generated design page
 * reads the same whatever appearance the surrounding browser is using.
 */
export function DesignAppearanceScope({
  appearance,
  children,
}: {
  appearance: DesignAppearance;
  children: ReactNode;
}) {
  return (
    <AppearanceContext value={appearance}>
      <div className="ce-design" data-mbk-appearance={appearance}>
        {children}
      </div>
    </AppearanceContext>
  );
}

export function useDesignAppearance(): DesignAppearance {
  return useContext(AppearanceContext);
}

/** Auto resolves through the system, so it needs the appearance it resolves to. */
export function resolveAppearance(
  choice: AppearanceChoice,
  system: DesignAppearance,
): DesignAppearance {
  return choice === "auto" ? system : choice;
}
