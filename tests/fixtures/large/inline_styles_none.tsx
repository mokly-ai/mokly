import type { ReactNode } from "react";

/** Default fixture marker without an additional React Native Web rule. */
export function InlineActionStyle({
  area,
  children,
}: {
  area: string;
  children: ReactNode;
}) {
  return <span data-scale-action={area}>{children}</span>;
}
