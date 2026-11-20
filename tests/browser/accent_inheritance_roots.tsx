/**
 * A browser entry of `accent_inheritance.spec.ts`: a selected tag chip and a
 * pressed icon control, which paint the three public accent properties, in a
 * Dark, an Auto, and a Light viewer root. Each root sits once inside a host
 * element that sets the three properties, and once inside an element that
 * sets none.
 */

import type { CSSProperties } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { IconButton } from "@mokly/ui/icon-control";
import { WorkspaceIcon } from "@mokly/ui/icons";
import { TagChip } from "@mokly/ui/tag-chip";

/** The host's accent, the ink on it, and its soft fill. */
const HOST_ACCENT: CSSProperties &
  Record<
    "--mokly-accent" | "--mokly-accent-contrast" | "--mokly-accent-soft",
    string
  > = {
  "--mokly-accent": "rgb(12, 34, 56)",
  "--mokly-accent-contrast": "rgb(255, 255, 254)",
  "--mokly-accent-soft": "rgb(232, 240, 244)",
};

/** One viewer root of an appearance, named for the spec, with its parent. */
function Root({
  hosted = false,
  name,
  theme,
}: {
  hosted?: boolean;
  name: string;
  theme: "auto" | "dark" | "light";
}) {
  return (
    <section
      aria-label={hosted ? `${name} root in a host` : `${name} root`}
      style={hosted ? HOST_ACCENT : undefined}
    >
      <div className="mbk" data-mokly-theme={theme}>
        <TagChip selected tag="forms" />
        <IconButton
          label="Highlight components"
          pressed
          title="Highlight components"
        >
          <WorkspaceIcon name="highlight" />
        </IconButton>
      </div>
    </section>
  );
}

document.body.innerHTML = renderToStaticMarkup(
  <>
    <Root hosted name="Dark" theme="dark" />
    <Root hosted name="Auto" theme="auto" />
    <Root hosted name="Light" theme="light" />
    <Root name="Dark" theme="dark" />
    <Root name="Auto" theme="auto" />
    <Root name="Light" theme="light" />
  </>,
);
document.body.dataset["rendered"] = "";
