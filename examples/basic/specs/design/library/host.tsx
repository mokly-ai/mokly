import type { ReactNode } from "react";

import type { RenderInput } from "@mokly/mokly";

import { PreviewWorkspace } from "../components/parts/workspace.js";

/** Standalone samples share tokens and layout constraints, without scenario data. */
export function LibraryHost({
  input,
  children,
}: {
  input: RenderInput;
  children: ReactNode;
}) {
  // Library paths are design/library/{group}/{slug}, then a variant's slug.
  const slug = input.entry.path.split("/")[3] ?? "";
  const content =
    slug === "inspector" ? (
      <PreviewWorkspace
        inspector={children}
        render={() => null}
        viewport={input.viewport}
      />
    ) : slug === "metadata-row" && input.props.presentation === "props" ? (
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
