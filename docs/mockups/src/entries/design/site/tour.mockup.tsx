import { defineUseCase } from "@mokly/mokly";

import { SITE_METADATA } from "../../../screens/design/site/parts/metadata";

const screens = [
  "design/site/home",
  "design/site/docs",
  "design/site/changelog",
  "design/site/terms",
  "design/site/privacy",
  "design/site/complaints",
  "design/site/security",
] as const;

export default defineUseCase({
  ...SITE_METADATA,
  description: "Home to the documentation, changelog and legal documents.",

  steps: screens.map((screenPath) => ({ screenPath })),
  tags: ["site", "folio"],
  title: "Site tour",
});
