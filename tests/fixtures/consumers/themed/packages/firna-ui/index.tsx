import React, { createContext, type ReactNode, useContext } from "react";
import { View } from "react-native";

const ThemeContext = createContext("unconfigured");

export function FirnaThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider value="fixture-theme">
      {children}
    </ThemeContext.Provider>
  );
}

export function FirnaCard({
  accent,
  children,
  compact = false,
}: {
  accent: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <View
      data-accent={accent}
      data-compact={compact ? "true" : "false"}
      data-theme={useContext(ThemeContext)}
    >
      {children}
    </View>
  );
}

export function collectFirnaStyles() {
  return "[data-theme='fixture-theme']{box-sizing:border-box}";
}

export function FirnaButton({ children }: { children: ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="fixture-button"
      data-theme={useContext(ThemeContext)}
    >
      {children}
    </div>
  );
}
