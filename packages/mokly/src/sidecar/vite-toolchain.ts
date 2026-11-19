import { createHash } from "node:crypto";

import { build } from "esbuild";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { toolchainIdentity } from "./toolchain.js";
import { loadVite, withVitePeers } from "./vite-peers.js";

/** Extend the existing installed-program identity with the selected Vite peer. */
export async function viteToolchain(
  version: string,
  root: string,
): Promise<string | undefined> {
  const identity = await toolchainIdentity();
  return identity
    ? createHash("sha256")
        .update(JSON.stringify([identity, version, root]))
        .digest("hex")
    : undefined;
}

/** Reuse checks resolve the current peer through the original side's policy. */
export async function currentViteToolchain(
  params: BundleParams,
): Promise<string | undefined> {
  return withVitePeers(params, build, async (require) => {
    const { api, root } = await loadVite(require);
    return viteToolchain(api.version, root);
  }).catch(() => undefined);
}
