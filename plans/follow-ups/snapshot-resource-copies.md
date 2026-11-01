# After snapshots repeat the current resource files

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-01, from an outside-scope note of the closed "dedup 4"
  workspace of 2026-10-27, measured again on 2026-11-01.
- **Location:** `crates/mokly-static/src/comparison_files.rs:45` and line
  55, and `docs/protocol/mokly-comparison-panes.md:44`.
- **Reason:** The dedup 4 plan put this copy outside its scope, and its
  cost on a catalogue with large images is not known.

- **Terms:**
  - **Comparison generation:** the directory
    `mokly-viewer/diffs/generations/{generation}/` that a build with Changes
    writes. It holds `snapshots/before/` and `snapshots/after/`.
  - **Pane:** one side of a comparison. The viewer shows the snapshot HTML
    with one `<base href>` at the pane's snapshot address, as
    `docs/protocol/mokly-comparison-panes.md:44` says.
- **Background:**
  - `side` in `crates/mokly-static/src/comparison_files.rs` copies each
    generated resource at line 45 and each public file at line 55 into the
    side's snapshot tree.
  - The same build also writes these files at their current addresses under
    `static/`. The after side of one build is that same build.
  - On 2026-11-01, `main` at `c553bd6f` built `examples/basic`. All 41
    after-side resources, 130,210 bytes, were byte-equal to files under
    `static/`. One example is
    `static/mokly-generated/styles/examples/basic/design-component-controls.css`.
  - The after-side documents are not copies. They lack the inspector
    script that the current documents carry.
  - `mokly publish` sends each digest once, so the copies cost disk, build
    memory, and file count, not upload bytes.
  - A one-time probe on 2026-11-01 used the release binary `2a196323`, built
    from commit `8efaa239` of the branch
    `conductor/rust-rebuild-64-opaque-asset-digests`. Its HTML fixture holds
    one 60 MiB opaque asset that one stylesheet references, and its head
    edits the one screen. Three builds with Changes against `HEAD` reached a
    peak RSS of 215,320 to 224,032 KiB. Three builds with `--no-changes`
    reached 90,884 to 99,628 KiB.
  - `crates/mokly-static/src/resource_bytes.rs:22` reads each snapshot asset
    whole into the in-memory output inventory, for each side, through the
    resource loop at line 45 of `comparison_files.rs`. The base of that
    fixture needs no sidecar, so its base delivery streams from Git. The
    difference of about 120 MiB matches one whole copy of the 60 MiB asset
    for each snapshot side.
  - Two fixes are known. In a static build, the viewer could give the after
    pane a base under `static/` and the build could skip the after-side
    resources. Or each snapshot resource could be stored once by content
    address. Both change protocol rules: the pane base rule, or the snapshot
    layout and the generation id.
- **Task:**
  1. Build a catalogue whose resources include large images, with Changes.
  2. Measure the share of the output that after-side resource copies take.
  3. When the share is large, bring the two fixes to the user as a
     decision. Otherwise delete this item.
- **Impact if no action:** Each build with Changes keeps one extra file for
  each current resource. In the example that is 41 files and 130,210
  bytes.
- **Needs:** Nothing beyond a catalogue with large images. The task needs no
  deployed change and no credentials.
- **Done when:** The measurement is recorded, and the item is either
  replaced by a decision for the user or deleted.
- **Related:**
  - [unread-comparison-snapshots.md](./unread-comparison-snapshots.md) and
    [skip-equal-before-snapshots.md](./skip-equal-before-snapshots.md)
    remove the other snapshot copies. Decide the snapshot layout together.
  - [git-opaque-asset-batching.md](./git-opaque-asset-batching.md) concerns
    the base delivery of extracted opaque assets. The build memory of its
    measurement of 2026-10-28 comes from the snapshot copies of this item.
