/** React-owned identifier scoping for independent embedded shell roots. */

import { createContext, useContext, type ReactNode } from "react";

const IdentifierPrefix = createContext("");

/** Prefix package-owned identifiers while leaving host slot children untouched. */
export function ShellIdentifierProvider({
  children,
  prefix = "",
}: {
  children: ReactNode;
  prefix?: string;
}) {
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
