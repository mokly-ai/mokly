import type { ReactNode } from "react";

import type { InteractiveRenderInput } from "@mokly/mokly";

import { PreviewWorkspace } from "../components/parts/workspace.js";

/** Standalone samples share tokens and layout constraints, without scenario data. */
export function LibraryHost({
  input,
  children,
}: {
  input: InteractiveRenderInput;
  children: ReactNode;
}) {
  const slug =
    input.entry.kind === "component"
      ? input.entry.variantOf.slice("design-ui-".length)
      : input.entry.id.slice("design-ui-".length);
  const props = input.componentProps;
  const content =
    slug === "inspector" ? (
      <PreviewWorkspace
        inspector={children}
        render={() => null}
        viewport={input.viewport}
      />
    ) : slug === "metadata-row" && props?.presentation === "props" ? (
      <dl className="ce-props">{children}</dl>
    ) : (
      children
    );
  return (
    <div
      className="ce-design mbk-library"
      data-library-component={slug}
      data-mbk-appearance={input.colorScheme}
    >
      <div className={`mbk-library-host mbk-shell--${input.viewport}`}>
        {content}
      </div>
    </div>
  );
}
