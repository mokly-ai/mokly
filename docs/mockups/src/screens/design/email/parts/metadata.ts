/**
 * Shared entry metadata and stylesheets for the two delivered email screens.
 * The root `mokly.config.json` links the same stylesheet list for the email
 * documents, and a policy test proves that this module's copy of the brand
 * file names still equals the one the message renders.
 */

/** The only stylesheets an email document links: the base and this frame. */
export const EMAIL_STYLE_FILES = ["styles/base.css", "styles/email/frame.css"];

/** The logos' folder below `docs/mockups`, beside the frame stylesheet. */
export const EMAIL_BRAND_ROOT = "styles/email/";

/** The copies of the published lockups the catalogue's own documents load. */
export const EMAIL_BRAND_FILES = [
  "mokly-logo-dark.png",
  "mokly-logo-light.png",
];

/** Protocol documents every email entry answers to. */
export const EMAIL_RELATED_DOCS = [
  "docs/protocol/cloud/email.md",
  "docs/protocol/cloud/design-tokens.md",
  "docs/protocol/cloud/design-tokens-color.md",
  "docs/protocol/cloud/product-copy.md",
];

/** Tags every email screen carries: its own family and the Folio theme. */
export const EMAIL_TAGS = ["email", "folio"];
