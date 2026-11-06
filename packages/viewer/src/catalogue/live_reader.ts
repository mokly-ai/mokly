/** The live descriptor v3 reader: gate the version and copy the capability. */

import type { LiveDescriptorV3 } from "@mokly/model";

import { record } from "../components/data.js";

import { MoklyVersionError } from "./version_error.js";

/** The only live descriptor number this viewer reads. */
const LIVE_DESCRIPTOR_VERSION = 3;

/** Read the supported live format without checking its content again. */
export function readLiveDescriptor(value: unknown): LiveDescriptorV3 {
  const version = record(value) ? value.schemaVersion : undefined;
  if (version !== LIVE_DESCRIPTOR_VERSION)
    throw new MoklyVersionError("live", version, LIVE_DESCRIPTOR_VERSION);
  return structuredClone(value) as LiveDescriptorV3;
}
