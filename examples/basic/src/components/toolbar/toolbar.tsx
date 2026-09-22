// The product-style Toolbar layout. Registration lives beside it in
// toolbar.mokly.tsx, which supplies the registered Action instances.
import type { ReactNode } from "react";

export interface ToolbarProps {
  actions: ReactNode;
  children?: ReactNode;
  title: string;
}

export function Toolbar(props: ToolbarProps) {
  return (
    <section className="example-toolbar">
      <h2>{props.title}</h2>
      <div>{props.children}</div>
      <div className="example-toolbar-actions">{props.actions}</div>
    </section>
  );
}
