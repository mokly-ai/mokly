# Tell Mokly Cloud about the frame probe rename

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-04, from the post-merge section of the deleted plan `plans/frame-package.md`, on the branch `calummoore/viewer-inspector-purpose`.
- **Location:** None. The work is in the `mokly-ai/mokly-cloud` repository.
- **Reason:** The Mokly Cloud change needs a released version of this repository first.

- **Terms:**
  - **Frame probe:** the script that runs inside a cross-origin preview page
    and talks to `postMessageAdapter`. It was named the inspector before.
  - **Pin bump:** the change in Mokly Cloud that moves its exact pins of
    `@mokly/viewer` and `@mokly/mokly` to a newer release.
- **Background:**
  - A breaking change renamed the published names of the in-frame script:
    `/mokly-viewer/client/inspector.js` became
    `/mokly-viewer/client/frame-probe.js`, the message channel
    `mokly-inspector` became `mokly-frame-probe` with wire version 3, and
    the page markers became `template[data-mokly-frame-probe]` and
    `data-mokly-frame-probe-link`.
  - A page published before the rename and a viewer after the rename reject
    each other, so cross-origin inspection stops until the page is
    published again. `docs/guides/start/upgrade.md` gives the step.
  - `@mokly/viewer` now depends on two new packages, `@mokly/model` and
    `@mokly/frame`. Mokly Cloud keeps importing `postMessageAdapter` from
    `@mokly/viewer`, so its imports do not change.
  - The Mokly Cloud contract fixtures, such as
    `crates/mkc-mokly-contract/fixtures/inventory.json`, list
    `mokly-viewer/client/inspector.js`.
- **Task:**
  - When Mokly Cloud bumps its pins past the release with the rename, tell
    its owners to regenerate the contract fixtures with
    `cargo xtask mokly-fixtures`, so that they name `frame-probe.js`.
  - Tell them to publish each hosted catalogue again with the new CLI.
  - Delete this item when the message is sent.
- **Impact if no action:** After the pin bump, cross-origin inspection in
  Mokly Cloud stops for every catalogue that was published before the
  rename.
- **Needs:** The released version with the rename.
- **Done when:** Mokly Cloud has the instructions, and this item is
  deleted.
