import {
  EARLIER_MANIFEST_NAMES,
  MANIFEST_NAME,
} from "../dist/registry/manifest.js";

export const [FORMER_MANIFEST_NAME, LEGACY_MANIFEST_NAME] =
  EARLIER_MANIFEST_NAMES;

export const metadataRoutes = [
  MANIFEST_NAME,
  FORMER_MANIFEST_NAME,
  LEGACY_MANIFEST_NAME,
  "metadata.json",
];

export const publicJson = '{"theme":"light"}';
