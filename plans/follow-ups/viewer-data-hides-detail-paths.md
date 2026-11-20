# The viewer data entry hides the detail paths

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-17, from the gap list `plans/follow-ups/mokly-upstream-gaps-to-file.md`, which the Mokly 0.18.0 upgrade of the cloud wrote on 2026-11-02 on the branch `calummoore/mokly-cli-upgrade`. The move of Mokly Cloud into this repository split that list into items.
- **Location:** `packages/viewer/src/data.ts:19-22`, `packages/viewer/src/catalogue/delivery_paths.ts:30-43`, and the copy in `apps/app/src/viewer/catalogue-source.web.ts:36-67`.
- **Reason:** The fix adds public exports to `@mokly/viewer/data`, which the user decides.

- **Source:** Design.
- **Category:** Code structure.
- **Background:**
  - An embedded viewer takes each entry detail from the `detail` source of its host. A host that reads the details from the artifact origin needs the detail path rules.
  - `entryDetailPath` and `removedEntryDetailPath` in `packages/viewer/src/catalogue/delivery_paths.ts:30-43` hold the rules. A current detail is at `mokly-viewer/entries/{path}.json`. A removed detail is at `entries/{path}.json` beneath the `comparisonUrl` of the index.
  - `@mokly/viewer/data`, in `packages/viewer/src/data.ts`, exports `generatedResourcePath` and `generatedResourceRoute` from that module, but not the two detail path functions.
  - So the Mokly Cloud app restates both rules in `apps/app/src/viewer/catalogue-source.web.ts:36-67`, and its comment says why. It encodes each path segment with `encodeURIComponent`, while the viewer uses its own `encodeUrlPath`.
- **Problem:** A host restates the detail path rules of the viewer, and its copy can drift from them.
- **Impact if no action:** A change of the detail layout or of the path encoding breaks the detail reads of the cloud, and no type check finds it.
- **Root question:** How does a host get the detail path rules of the viewer?
- **Options:**
  - **A.** Keep the restated rules in each host. Effort: Small.
  - **B.** Export `entryDetailPath` and `removedEntryDetailPath` from `@mokly/viewer/data`, document them, and move the cloud app to them. Effort: Small.
- **Left out:** Return a URL from the `detail` source and let the viewer fetch it. The viewer fetches a URL with `credentials: "omit"`, as `docs/protocol/mokly-viewer.md:66-69` states, so a private catalogue cannot send its cookie.
- **Wider fix:** B. One module then owns each path rule.
- **Previous examples:** `@mokly/viewer/data` already exports the document, snapshot and view path functions.
- **Related:** `plans/follow-ups/workspace-presentation-rule-not-exported.md` has the same class of problem: a consumer restates a rule of the viewer, and the same kind of export answers it.
- **Recommendation:** B. The host then uses the rules that the viewer uses.
- **Action:** ask the user, because B adds exports to the public API of `@mokly/viewer`, which no requirement covers.
