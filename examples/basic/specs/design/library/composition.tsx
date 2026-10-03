import { createContext, useContext, type ReactNode } from "react";

const InstanceScope = createContext<string>("");

/** Ordinary layout can name repeated regions without hiding their component usage. */
export function DesignInstances({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  const parent = useContext(InstanceScope);
  return (
    <InstanceScope value={parent ? `${parent}-${name}` : name}>
      {children}
    </InstanceScope>
  );
}

export function useDesignInstance(name: string): string {
  const scope = useContext(InstanceScope);
  return scope ? `${scope}-${name}` : name;
}

/** Preserve omitted optional data rather than passing an explicit undefined value. */
export function optional<K extends string, V>(
  key: K,
  value: V | undefined,
): { [P in K]?: V } {
  return (value === undefined ? {} : { [key]: value }) as { [P in K]?: V };
}
