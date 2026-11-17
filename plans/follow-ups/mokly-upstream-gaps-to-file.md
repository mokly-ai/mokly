# Mokly upstream gaps to file

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-02, from the "Mokly Repository Work" list of the Mokly 0.18.0 upgrade plan on the branch `calummoore/mokly-cli-upgrade`, deleted with that change.
- **Location:** None.
- **Reason:** The user files these gaps in `mokly-ai/mokly` (Decision 8 of 2026-10-26), and each fix reaches the cloud only in a later, separate pin bump.

- **Terms:**
  - **Pin bump:** a change that moves the exact-pinned `@mokly/mokly`, `@mokly/viewer` and `@mokly/ui` versions, in its own change, as `AGENTS.md` says.
- **Background:**
  - On 2026-10-26 the user chose to file the gaps that the cloud finds in the open repository.
  - The upgrade found these gaps in the 0.18.0 release. Two gaps of 2026-10-26 are fixed in 0.18.0: the guides no longer document `serve --build`, and the namespace doc lists entry detail version 4.
- **Task:** File one issue in `mokly-ai/mokly` for each gap below, or group the gaps that share a cause:

- The viewer has no host transport for pinned comparison documents and
  removed previews, and the standalone shell sends no credentials, so private
  catalogues cannot show Changes or open in their own tab.
  `plans/follow-ups/private-catalogues-lose-changes-and-blocked-cookie-access.md`
  depends on it.
- `serve` has no `--no-changes`, so a served test suite always starts a
  background comparison.
- `@mokly/viewer/data` does not export the entry detail path functions, so a
  host restates the current and removed detail path rules.
- On every 426 the CLI says "Update the service and try again", which is
  wrong advice for an older producer that the cloud refuses.
- `mokly-shell-delivery.md` says the index is `schemaVersion: 8`, while the
  format inventory, the generated types and `readCatalogueIndex` require 9.
- `mokly-removed-previews.md` says a removed detail carries `generation`,
  while `mokly-shell-delivery.md` and the 0.18.0 changelog say it does not.
- A React-authored entry builds different `documentKey` and `deploymentId`
  values in two checkouts of the same commit at different absolute paths,
  while a native HTML entry builds identical bytes. Found on 2026-11-01
  with a one-screen probe of 0.18.0.
- A React screen renders its registered components inline, but the upgrade
  guide says that each component render sets up its own providers.
- A component's own page renders no slot content, so the own page of a
  component that draws its content in slots shows an empty frame.
- `StageOverlay` of `@mokly/ui` renders `hidden` until a browser
  measurement, so a static mockup cannot show it. A static mode, such as the
  `rect` of `HighlightMask`, would let a drawing place it.
- Each built document links Mokly's inspector script by the root-absolute
  path `/mokly-viewer/client/inspector.js`, so a document that opens from
  disk, or that is served below the origin root, requests a file outside the
  output.
- The serializer writes `:xmlns` in place of `xmlns` on inline SVG elements
  of React documents. Browsers show no difference.
- `publish` runs `git status` without `--no-optional-locks`, which rewrites
  `.git/index` right after a commit, against the installed `mokly-git.md`.
- `@mokly/ui` 0.18.0 declares `--mokly-accent`, `--mokly-accent-contrast`
  and `--mokly-accent-soft` again on its own root `.mbk`, so a value that the
  host sets on its container loses in Dark, against the installed
  `mokly-viewer-appearance.md`. Found on 2026-11-01 by the mockup work item.
  `plans/follow-ups/viewer-dark-accent-ignores-folio.md` depends on it.
- No public export gives the presentation rule of a workspace for a static
  depiction: the shown view and fallback of each frame, the status, the
  comparison eligibility and the view-control marks. Static mockups restate
  the rule of `mokly-changes-controls.md`. Found on 2026-11-02 by the review
  of the mockup work item.

- **Impact if no action:** The cloud keeps its workarounds, and the follow-up items that wait for a Mokly release stay blocked.
- **Needs:** Access to `mokly-ai/mokly`.
- **Done when:** Each gap has an issue in `mokly-ai/mokly`, and each follow-up item that waits for one names its issue.
