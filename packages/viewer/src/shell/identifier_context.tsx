/** React-owned identifier scoping for independent embedded shell roots. */

import { createContext, useContext, useId, type ReactNode } from "react";

const IdentifierPrefix = createContext("");

/** Prefix package-owned identifiers while leaving host slot children untouched. */
export function ShellIdentifierProvider({
  children,
  scoped = false,
}: {
  children: ReactNode;
  scoped?: boolean;
}) {
  const generated = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const prefix = scoped ? `mokly-${generated}-` : "";
  return (
    <IdentifierPrefix.Provider value={prefix}>
      {children}
    </IdentifierPrefix.Provider>
  );
}

/** Resolve one package-owned identifier in the current shell root. */
export function useShellIdentifier(value: string): string {
  return `${useContext(IdentifierPrefix)}${value}`;
}

/** Resolve a dynamic family of package-owned identifiers in one shell root. */
export function useShellIdentifierScope(): (value: string) => string {
  const prefix = useContext(IdentifierPrefix);
  return (value) => `${prefix}${value}`;
}

/** Resolve a same-document link to one package-owned identifier. */
export function useShellFragment(value: string): string {
  return `#${useShellIdentifier(value)}`;
}
