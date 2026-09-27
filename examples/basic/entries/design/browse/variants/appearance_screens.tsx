import type { ScreenVariantInput } from "@mokly/mokly";

import { DESTINATIONS } from "../../parts/destinations.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import {
  AppearanceHead,
  AppearanceShell,
  AppearanceWorkspace,
} from "../appearance/parts/scaffold.js";

type Subject = "welcome" | "details";

function SchemeVariant({
  subject,
  viewport,
}: {
  subject: Subject;
  viewport: ArtboardViewport;
}) {
  const details = subject === "details";
  return (
    <AppearanceShell
      activeLabel={details ? "Details" : "Welcome"}
      design={
        details
          ? DESTINATIONS.detailsAppearanceVariant
          : DESTINATIONS.welcomeAppearanceVariant
      }
      viewport={viewport}
    >
      <AppearanceHead
        idChip={details ? "example-details" : "example-welcome"}
        title={details ? "Details" : "Welcome"}
        viewport={viewport}
      />
      <AppearanceWorkspace subject={subject} viewport={viewport} />
    </AppearanceShell>
  );
}

/** Existing Welcome-variant ids now use the catalogue's one Appearance setting. */
export const browseSchemeVariants = [
  {
    description:
      "Welcome following the catalogue Appearance setting in both schemes.",
    desktop: <SchemeVariant subject="welcome" viewport="desktop" />,
    id: "design-browse-dark-scheme",
    mobile: <SchemeVariant subject="welcome" viewport="mobile" />,
    rationale:
      "This established variant route retains its identity while the shared Appearance selector changes the whole catalogue and the Welcome preview together. The header only selects the viewport.",
    slug: "dark-scheme",
    title: "Welcome appearance",
  },
  {
    description:
      "Details keeps its light device frames when the catalogue is Dark.",
    desktop: <SchemeVariant subject="details" viewport="desktop" />,
    id: "design-browse-light-only",
    mobile: <SchemeVariant subject="details" viewport="mobile" />,
    rationale:
      "This established variant route follows the shared Appearance selector. Details has no dark render, so its device frame stays light and names the fallback when the catalogue is Dark.",
    slug: "light-only",
    title: "Details light-only fallback",
  },
] satisfies readonly ScreenVariantInput[];
