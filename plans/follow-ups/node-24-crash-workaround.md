# Mokly rejects Node 24.14 through 24.18

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-17, from the branch `calummoore/improve-user-onboarding-experience-4ik4`, where the user deferred the decision.
- **Location:** `packages/mokly/src/version.mjs`, which rejects the versions; `packages/mokly/src/sidecar/`, which loads consumer modules; `docs/protocol/mokly-package.md`, section "Node Support".
- **Reason:** On 2026-11-17 the user chose to defer support for these versions, so the work waits for a later decision.

- **Terms:**
  - **Shim:** `packages/mokly/bin/mokly.mjs`, the JavaScript entry point that checks the Node version and starts the native binary.
  - **Sidecar:** the Node process that bundles and renders JavaScript screens, components, and PostCSS inputs. It runs on the consumer's Node.
- **Background:** Mokly supports Node `>=22.15.0 <23.0.0 || >=24.0.0 <24.14.0 || >=24.19.0`. Node 24.14.0 through 24.18.x can abort the process when ES modules load CommonJS modules concurrently, before JavaScript can handle the error. The upstream fix, `cjs_lexer::Parse` empty `MaybeLocal` (https://github.com/nodejs/node/pull/63885), shipped in Node 24.19.0. The shim rejects these versions at startup, and the message tells the user to install Node 24.19 or later. The published `engines` range of `@mokly/mokly` is `>=22.14.0`, wider than the supported range, so npm installs the latest release on these versions and the shim gives that message.
- **Problem:** Users on Node 24.14 through 24.18 cannot run Mokly until they update Node. Node 24 is the active LTS line, so CI images and machines that are a few months old can be on these versions.
- **Impact if no action:** These users must update Node before their first command. The group shrinks as Node 24.19 and later spread.
- **Root question:** Should Mokly run on Node 24.14 through 24.18, and what must change so that the Node bug cannot abort the sidecar?
- **Options:**
  - **A.** Keep the rejection. No cost; the shim message already names the fix. Effort: Small.
  - **B.** On the affected versions only, serialize the sidecar's loads of consumer modules, so that no two ES-module-to-CommonJS loads run at the same time. Then accept the versions in the shim and in `SUPPORTED_NODE_RANGE`, and update the protocol doc. It needs a stress test that reproduces the abort on 24.18 and passes with the change. A load path that the change misses still aborts. Serial loads slow sidecar startup on those versions. Effort: Medium.
  - **C.** Run the sidecar on a Node runtime that Mokly provides, not on the consumer's Node. It removes every Node-version gap in the sidecar, but it adds a large download and breaks module resolution in the consumer's environment. Effort: Large.
- **Left out:** Accepting the versions without a workaround, because the process can abort without a diagnostic.
- **Wider fix:** C, because it removes the dependence on the consumer's Node. Its cost is far above the value for a range that shrinks.
- **Previous examples:** None found.
- **Related:** None.
- **Recommendation:** A. The clear shim message and the widened `engines` range already make the fix plain, and the affected range shrinks over time. Option B is the next step if users report that they cannot update Node.
- **Action:** ask the user, because the user deferred this choice on 2026-11-17 and it changes which Node versions Mokly supports.
