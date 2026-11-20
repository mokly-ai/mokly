# Resolve peers without an esbuild run

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from the branch `conductor/storybook-support-d-vite-adapter`.
- **Location:** `packages/mokly/src/sidecar/vite-peers.ts:18`, `packages/mokly/src/sidecar/vite-toolchain.ts:22`, `packages/mokly/src/sidecar/paths.ts:20`.
- **Reason:** The clean fix changes `paths.ts`, which other tracks of the Storybook support work change at the same time, so it waits until they merge.

- **Source:** Implementation.
- **Category:** Code structure.
- **Terms:**
  - **Peer:** a package that the sidecar loads at render time from the project's installation, such as `react`, `react-dom`, `@storybook/react`, and `vite`.
  - **consumerRequire:** the function in `packages/mokly/src/sidecar/paths.ts` that resolves the peers of one side and gives a snapshot of them for the compiled recipe.
  - **Vite adapter:** the optional compile path that compiles JavaScript through the project's own Vite setup.
- **Background:**
  - `consumerRequire` resolves each peer through an esbuild plugin context. Its `peerPlugin` stores that context in `onStart` and drops it in `onEnd`. So a peer resolves only while an esbuild build runs.
  - The Vite adapter needs the same peer resolution and snapshot, so that both compile paths load one React copy. To reuse `consumerRequire` without an edit to `paths.ts`, `withVitePeers` in `packages/mokly/src/sidecar/vite-peers.ts` starts a minimal esbuild build and runs the whole Vite compile inside the `onLoad` hook of its one virtual module.
  - The reuse check of a Serve edit, `currentViteToolchain` in `packages/mokly/src/sidecar/vite-toolchain.ts`, starts another such esbuild build to find the current `vite` package.
- **Problem:** The Vite compile runs inside an esbuild hook only to keep a resolver alive. The structure hides the real dependency, costs one esbuild build for each Vite compile and each reuse check, and ties the Vite path to esbuild's plugin lifecycle.
- **Impact if no action:** The Vite path stays harder to read and to change. An esbuild change to the plugin lifecycle can break the Vite compile.
- **Root question:** How does the Vite path resolve the side's peers with the same rules as the esbuild path, without an esbuild build?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Give `consumerRequire` a resolver that does not depend on an esbuild build, such as one built on Node's resolution with the side's mapping in `importer-resolution.ts`. The esbuild path keeps its plugin context. The Vite path calls the new resolver directly. Effort: Medium.
  - **C.** Resolve the Vite path's peers through the Vite setup's own lookup, which the Vite path already uses for every import, and keep `consumerRequire` for the esbuild path only. Effort: Medium.
- **Left out:** None.
- **Wider fix:** B. One peer resolver then serves both compile paths without a build.
- **Previous examples:** None found.
- **Recommendation:** B. It removes the workaround and keeps one peer rule for both compile paths. C is also sound when the Vite path's peer table already comes from its own lookup.
- **Action:** fix after merge, apply B, because `paths.ts` changes in other tracks now.
