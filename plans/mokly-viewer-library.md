# Mokly Viewer Library

Extract Browse into a separately published `@mokly/viewer` React package that
Mokly Cloud can mount around cross-origin screen frames, and promote the public
contracts it depends on: component-instance identity, a versioned catalogue read
model, the viewer API, and a frame adapter with an embedded inspector script.
The cloud consumes only published npm packages and documented export artifacts;
this repository gains no cloud-specific mode, flag, or branch.

Milestones follow the requested order. The user has approved all seven decisions
below and the hard constraint; the Milestone 1 confirmation TODOs are satisfied.
Work stops for review after every milestone. No new product screens are designed:
the viewer renders the existing shell design unchanged and pick mode reuses the
Highlight components visuals, so no mockup milestone is planned. If a genuine
visual gap appears, add a `Tags: mockup` milestone before the affected UI work.

## Hard constraint: no visible change to the local product

`mokly serve` and `mokly export` must look and behave exactly as they do
today. The same shell markup, shell CSS, and enhancement runtime ship from the
new package. The read model file, the inert inspector script, source-location
data, and host-only pick mode are invisible locally: nothing new is rendered,
linked, or reachable in the shell. Any milestone that would change a pixel or
an interaction locally stops for user approval first.

## Findings that shape the design

- `src/server/shell/*.tsx` already renders the shell with React
  `renderToStaticMarkup`; `src/client/*.ts` is a vanilla enhancement runtime
  bundled by `scripts/copy-assets.mjs` into `dist/browser/*.js` and published
  under `__mokly/client/`. No React ships to the browser today.
- Same-origin frame access lives in `component_geometry.ts`,
  `component_range_nodes.ts`, `component_occlusion.ts`,
  `component_highlight.ts`, `frame_navigation.ts`, `browse_state.ts`,
  `control_transport.ts`, and `workspace_preview.ts`.
- Instance keys (`src/components/keys.ts`) are SHA-256 digests of
  `["mokabook-instance-v1", owner.kind, ownerInstanceKey|null, slotKey|null, id]`.
  Props and `order` are not part of the key. Boundary markers are rewritten to
  `<!--mokly-component:(start|end):r-<n>-->` comments by `src/components/ranges.ts`.
- The consumer bundle (`src/build/load_graph.ts`) uses esbuild `jsx: "automatic"`
  without `jsxDev`, so no invocation file/line/column is captured anywhere.
- `mokly-manifest.json` is denied at every public boundary
  (`src/config/public_files.ts`), and `mokly-source-protection.md` states no
  public manifest endpoint exists. The export layout, ownership inventory v1,
  `review.json`, and `mokly-upload.json` v1 are pinned by the cloud.
- The repository is one npm package (`@mokly/mokly`, root `package.json`) with
  no workspaces; release-please manages a single component.

## Proposed decisions to confirm with the user

All seven decisions are approved. The precise record/key scope below reflects
the existing implementation and the Milestone 1 contracts, without a key change.

1. **Instance key format is unchanged.** The existing digest already satisfies
   the stability rule: it changes only when the instance's `moklyInstance` id,
   its input owner kind or parent instance key, or its original slot key changes.
   The containing entry id is not hashed; moving entries changes the scoped
   reference even when the digest stays the same.
   Prop edits and sibling reordering keep the key. Duplicate ids in one scope
   remain a build error.
2. **Resolution states** are computed from records only: `present` (same key,
   same `propsKey`, same `order`, same slot), `moved` (same key, different
   `propsKey`, `order`, or normalized slot), `missing` (key absent). Physical
   range placement is not a field in an instance-record pair. Resolution
   is a pure documented function the viewer exports; no comparison data needed.
3. **Source locations need a build-step change.** Proposal: enable esbuild
   `jsxDev: true` for consumer entries and resolve `react/jsx-dev-runtime` to a
   Mokly-owned shim that forwards to `react/jsx-runtime` and attaches the
   `__source` location only for `defineComponent` wrappers, via a reserved
   prop the wrapper strips like `moklyInstance`. Locations are repo-relative
   paths with 1-based line/column, optional, excluded from `propsKey` and from
   change attribution, and never absolute. This adds an optional `source` field
   to `ComponentInstanceRecord` in manifest v5 (additive; readers must accept
   both forms). Alternative: defer locations and ship `source` as absent.
4. **Read model is a public projection, not the manifest.** Export writes
   `__mokly/catalogue.json` (`schemaVersion: 1`) and Serve serves the same
   path. The manifest stays private because it carries the `sourceFiles`
   inventory, dependency evidence, and legacy envelopes; the projection is
   smaller, stable, and public-safe. It includes catalogue identity,
   `deploymentId`, the collections/pages tree, screens with routes, tags,
   viewports, color schemes and per-view fragment paths, use-case flows,
   registered components and variants, per-view instance records, per-entry
   Changes state, and the pinned `review.json` URL. Adding a file does not
   change the ownership v1 or upload v1 schemas; it only appears in their
   inventories.
5. **Viewer architecture: React markup plus framework-neutral enhancement.**
   `<MoklyViewer>` renders the existing shell TSX and boots the existing
   enhancement runtime in an effect. Export keeps SSR-only output with no React
   in the browser, so static output stays functionally identical. Hosts that
   mount the viewer client-side get the same runtime attached to React-owned
   markup; slots are React-owned containers the runtime never touches;
   controlled props and the imperative handle drive the runtime. Alternative:
   full client hydration shipping React into exports (rejected: changes the
   browser module graph and deployment bytes for no local benefit).
6. **Cross-origin frames must have a real origin.** The `postMessageAdapter`
   takes an explicit `frameOrigin`, rejects opaque (`"null"`) origins, and
   requires `sandbox="allow-same-origin allow-scripts"` on the sandboxed
   subdomain. The inspector script learns its expected host origin from a
   `mokly-host` query parameter added by the adapter, and pins the session
   nonce at handshake.
7. **Packages.** Add npm workspaces with `packages/viewer` as `@mokly/viewer`;
   the root stays `@mokly/mokly` and depends on the viewer by version. Packed
   consumer smoke tests install both tarballs. release-please gains a second
   component so both packages release from one merge.

## Milestone 1: Protocol documentation (completed)

Define every contract before code. Approval of the seven decisions and local
invisibility constraint satisfies the confirmation items; later milestones
record any necessary contract clarifications before implementation.

- [x] Add `docs/protocol/mokly-instances.md`: key derivation and preimage,
      stability rule with an explicit list of edits that change or keep a key,
      resolution states and algorithm, optional `source` location fields and
      the build-step proposal, DOM marker attribute names, comment token
      format, and the one-start/one-end-pair-per-view guarantee.
- [x] Stop and confirm the instance contract with the user.
- [x] Add `docs/protocol/mokly-catalogue.md`: `__mokly/catalogue.json` shape
      with `schemaVersion: 1`, projection rules from manifest v5, omitted
      private fields, Changes state per entry, `review.json` pointer,
      additive-versus-breaking versioning, Serve availability, and same-origin
      and cross-origin fetch rules (public paths, required CORS and
      `nosniff` headers, no credentials).
- [x] Stop and confirm the catalogue contract with the user.
- [x] Add `docs/protocol/mokly-viewer.md`: `<MoklyViewer>` props, catalogue
      sources (object, URL, fetcher), controlled and uncontrolled selection,
      rendered feature inventory cross-referenced to `mokly-runtime.md`,
      slots, events, imperative handle, CSS variable prefix and theming
      boundary, SSR requirement, and host-independence constraints (no host
      knowledge, no network beyond the source, no cookies, no `window.top`).
- [x] Add `docs/protocol/mokly-frame-adapter.md`: `FrameAdapter` interface,
      `sameOriginAdapter` behavior, `postMessageAdapter` and inspector script
      protocol (`mokly-inspector` channel, version 1, handshake, nonce, exact
      origins, `event.source` check, bounded discriminated message shapes with
      unknown keys rejected, keys and boxes only, in-frame overlay, no
      top-window effects), the query-parameter host-origin rule, inertness
      without a handshake, and the script size budget.
- [x] Stop and confirm the viewer and frame-adapter contracts with the user.
- [x] Update overlapping docs: `mokly-export.md` (new public files, the
      Mokly-owned inspector script versus unchanged consumer content, the
      viewer package as a public API), `mokly-export-delivery.md` (routes
      table, cross-origin headers, sandbox attributes), `mokly-source-protection.md`
      (public read model beside the private manifest), `mokly-component-manifest.md`
      (optional `source` field), `mokly-component-explorer.md` and
      `mokly-navigation.md` (frame boundary through the adapter),
      `mokly-runtime.md` (Browse is the viewer), and `docs/protocol/README.md`.
- [x] Update `docs/architecture/package-boundary.md`, the root README, and
      `plans/README.md`; validate Markdown with Prettier and review the diff.
- [x] After Markdown checks pass, `git add -A`, commit with Conventional
      Commits, and push the documentation.
- [x] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      findings with severity, options and recommendations without changing
      the implementation, then stop before Milestone 2.

## Milestone 2: Instance identity implementation (completed)

Deliver the confirmed instance contract in the renderer, manifest, and tests
while keeping generated output for unchanged catalogues byte-identical apart
from the new optional field.

- [x] Add failing tests for key stability across prop edits, reorders,
      id changes, and re-parenting, plus resolution fixtures for `present`,
      `moved`, and `missing`.
- [x] Add a pure, exported instance resolution function under
      `src/components` with typed inputs from `ComponentInstanceRecord`.
- [x] Implement the confirmed source-location capture: esbuild `jsxDev`
      setting, the Mokly dev-runtime shim in the consumer React plugin,
      wrapper stripping, repo-relative path normalization, and rejection of
      absolute or escaping paths.
- [x] Extend manifest v5 validation and serialization with the optional
      `source` field; keep historical readers accepting records without it.
- [x] Exclude `source` from `propsKey`, change attribution, and the Changes
      calculation; add regression tests proving line shifts are not material.
- [x] Make structural Changes projections select their identity fields
      explicitly so invocation metadata cannot become comparison input.
- [x] Expose resolution through the consumer's attributed authoring facade
      as well as the public package entrypoint.
- [x] Update packed-consumer API allowlists and exercise exported instance
      records, resolution types, and source capture from the installed package.
- [x] Add a marker conformance test: every recorded range in each view has
      exactly one matched start/end comment pair in the rendered document,
      including replayed slots that give one instance several ranges.
- [x] Regenerate the example catalogue, run relevant tests and
      `cargo xtask check`, and update READMEs.
- [x] After checks pass, `git add -A`, commit the completed work with
      Conventional Commits, push, and stop for review.
- [x] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      against the complete local diff from `origin/main`; report findings
      without changing the implementation, then stop before Milestone 3.

Verification notes: the example retains its existing `generatedOutput: "derived"`
configuration. Its generated HTML and manifest remain ignored local artifacts;
tracking them would fail `example:check`. Regeneration produced 278 files:
all 277 HTML documents are byte-identical to the pre-milestone output, and the
manifest differs only by 1,911 optional instance source records. Authored CSS
is unchanged. The mobile and desktop Serve smoke checks passed after replacing
an unsuitable network-idle wait with explicit frame readiness. The 169 focused
component tests passed. The first full gate stopped on a test assertion lint
error; that assertion was corrected and the gate restarted.
The next run passed all 1,532 unit/integration tests and reached the packed ESM
API allowlist, which needed the new resolver export. The updated ESM, NodeNext,
clean-cache npx, Accounting and Juno consumers passed independently, including
installed-package source capture.
The final `cargo xtask check` passed: 1,532 unit/integration tests, 274 Chromium
tests, all five packed-consumer scenarios and three Rust tests, plus dependency
audits, formatting, lint, typechecking, example validation, package checks,
Clippy and the Rust file-length audit. No tests were skipped and no browser
retries were needed. Protocol edits only update the two source/identity delivery
statuses; the normative contract is unchanged.

Post-push review: implementation commit `1662441` was reviewed using the required
prompt against the complete branch diff from `origin/main`. No new findings were
identified and no implementation changes were made during review. The earlier
Milestone 1 marker-pair finding was addressed by `21f0cb2`. Residual test risk:
browser coverage is Chromium-only; programmatic or already-transformed calls
intentionally omit source when invocation information is unavailable.

## Milestone 3: Catalogue read model implementation (completed)

Write and serve the confirmed read model from the same projection code.

- [x] Add failing tests for projection shape, omitted private fields,
      deterministic serialization, schema-version fixture, and rejection of
      absolute paths or manifest-internal data.
- [x] Implement the projection module under `src/catalogue` behind a typed
      interface shared by Serve and export; add public fixtures under
      `docs/protocol/fixtures`.
- [x] Export writes `__mokly/catalogue.json` through the normal stage,
      inventory, collision, and deployment-identity flow; Serve serves it at
      the same path and refreshes it on watched updates.
  - [x] Exercise the real watched child and background evidence lifecycle
        through validated public snapshots and content/evidence revisions.
- [x] Add cross-origin fetch coverage: a static fixture server sending the
      documented headers and a browser test fetching the read model from a
      second origin.
- [x] Verify upload archives and ownership inventories include the file
      without schema changes; update packed-consumer and release fixtures.
- [x] Extend the bootstrap package fixture and keep simulated legacy previews
      free of the new catalogue file before testing their migration.
- [x] Retain exact screen-only per-view attribution for the public model,
      alongside existing resource evidence, without another comparison pass.
- [x] Give complete live comparisons a content-addressed public alias; leave
      selected-only generations unpinned and reject stale completion results.
- [x] Validate known usage union fields while tolerating additive fields;
      retain historical usage when current component props or slots change.
- [x] Include the read model in repository preview capture and prove shell
      HTML remains byte-identical apart from the stamped deployment identity.
- [x] Update READMEs and delivery statuses; run focused tests and
      `cargo xtask check`.
- [x] After checks pass, `git add -A`, commit with Conventional Commits, and push.
- [x] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      against the complete local diff from `origin/main`; record findings
      without changing the implementation, then stop before Milestone 4.

### Milestone 3 verification notes

The public v1 model now uses a shared typed allowlist projection for Serve,
consumer export and repository preview. Export finalization validates and stamps
its owned identity field after inventory/ownership assembly; upload and ownership
schemas stay at v1. Packed-consumer checks read the public file and extract it
from actual upload archives. The local shell still uses embedded data.

Tests were added before implementation for projection/privacy, canonical bytes,
fixture/version conformance, export inventory/identity and live GET/HEAD. Later
regressions captured contradictory usage union fields and historical component
slot changes before fixing them. Focused verification passes 20 catalogue tests
and seven Chromium browser tests, with no skips or retries. The real watched
child test covers content adoption, background evidence and metadata restarts;
stale complete comparisons cannot pin superseded evidence. All 20 exported HTML
files in the unchanged consumer fixture match pre-milestone bytes after
normalizing only the stamped deployment identity.

Documentation now marks catalogue delivery implemented while leaving the viewer
and inspector planned. One normative gap required clarification: existing live
comparison URLs use UUIDs and can represent selected-only results, whereas the
catalogue pointer requires a complete immutable 64-hex generation. Matching
complete results gain a content-addressed alias; selected-only results stay
unpinned, superseded completion is ignored, and unavailable aliases return 404
without redirects or generation. No other normative contracts or wire schemas
changed. The canonical public JSON fixture is exempt from Prettier because its
exact protocol serialization is covered by conformance tests.

The first full gate ran 1,552 Node tests and found seven fixture failures:
four bootstrap packages omitted the newly required public documentation, and
three simulated legacy previews incorrectly retained the new catalogue file.
The fixtures were corrected without relaxing production validation; all 15
affected regression tests pass. The second `cargo xtask check` passed all 1,552
Node tests, 276 Chromium tests, five packed-consumer scenarios and three Rust
tests, plus dependency audits, formatting, lint, typechecking, example validation,
package checks, Clippy and the Rust file-length audit (eight files). No tests
were skipped; there were no intermittent failures or browser retries. The
browser suite took 9.7 minutes, including its larger fixture preparation.
Markdown validation checked 168 local links; the diff has no file deletions
against the refreshed `origin/main`. Implementation commit `75d04b6` was pushed
before the review below. Milestone 4 has not started.

### Milestone 3 post-push review

1. **P2 — Historical usage can reference an omitted component.**
   [views.ts:51](../src/catalogue/views.ts#L51) publishes every retained baseline
   usage record as ready. When a removed screen used a component whose id is
   reused by a current page (or whose route is reused), current precedence in
   `removedManifestEntries` omits the old component metadata. The screen's
   instances still name that component. A read-only reproduction using the
   generated example verified that both input manifests pass `parseManifest`,
   while the projected model fails `readCatalogue` with an unknown-component
   reference. Doing nothing leaves Serve consumers with an unreadable snapshot
   and causes export finalization to reject otherwise valid input. **A
   (recommended):** centralize historical-reference availability during
   projection, publish unavailable usage when its component metadata cannot be
   retained under current precedence, and add Serve/export regressions for both
   id and route reuse. This addresses the whole reference-loss class without
   weakening the reader. **B:** extend the public contract with separately scoped
   historical component definitions; this preserves more inspection data but
   adds schema and reader complexity.

2. **P2 — Alias cleanup renews unused comparison retention.**
   [public_review.ts:68](../src/server/public_review.ts#L68) prunes aliases using
   `ReviewGenerationStore.get`, whose documented behavior renews the idle timer
   ([review_generations.ts:48](../src/server/review_generations.ts#L48)). Every new
   complete capture therefore touches every retained old generation. Repeated
   full refreshes less than 60 seconds apart keep unused snapshot directories
   alive and allow disk use to grow until captures stop. **A (recommended):**
   add a non-renewing presence/peek operation for pruning and cover repeated
   captures with a controlled-clock expiry test. Separating presence checks
   from retention renewal prevents the same cache-management mistake elsewhere.
   **B:** remove the sweep and prune only when expired aliases are requested;
   this restores snapshot expiry but leaves an accumulating alias map.

3. **P3 — Runtime delivery status still says the catalogue is unimplemented.**
   [mokly-runtime.md:31](../docs/protocol/mokly-runtime.md#L31) groups the public
   catalogue with the future viewer/frame work as not implemented, and the route
   paragraph near line 121 still describes it as an approved target. This
   contradicts the implemented endpoint and the updated catalogue/export docs,
   leaving readers uncertain which public boundary is available. **A
   (recommended):** update both runtime paragraphs and audit other catalogue
   delivery-status references when closing the remaining milestones. A focused
   documentation correction and checklist are sufficient here. **B:** introduce
   shared machine-readable delivery metadata and generated status snippets;
   that would prevent drift more broadly but adds tooling for a small set of
   milestone updates.

The required prompt reviewed the complete 117-file branch diff at `75d04b6`
against `origin/main` (`87daaa4`) after the implementation push. No findings were
automatically fixed. These recommendations await the user's decision; they do
not authorize starting another milestone. Browser verification remains
Chromium-only. Recording this review is a documentation-only follow-up.

## Milestone 4: Frame adapter and inspector script (completed)

Tags: ui

Move frame access behind the `FrameAdapter` interface and add the
cross-origin path.

- [x] Define `FrameAdapter` types in `src/client` with mount, list instance
      boxes, highlight, scroll-to, and hover, click, and navigation
      subscriptions; add a fake adapter for tests.
- [x] Extract `sameOriginAdapter` from the existing `contentDocument` modules
      without behavior change; existing browser tests must pass unchanged.
- [x] Write the inspector script as a dependency-free IIFE under
      `src/inspector`, bundled by `scripts/copy-assets.mjs`, with a size
      budget check in `scripts/package-check.mjs`.
- [x] Implement message schema validation shared by both sides: channel,
      version, nonce, discriminated `type`, bounded arrays and numbers,
      unknown keys rejected, `event.source` and exact origin checks.
- [x] Implement `postMessageAdapter` with the handshake, per-mount nonce,
      exact `frameOrigin`, opaque-origin rejection, and in-frame highlight
      overlay requests.
- [x] Embed the script through the Browse document adapter for current
      published HTML copies only; comparison snapshots remain byte-unmodified.
      Prove the script is inert without a handshake and never touches
      `window.top` or `parent.location`.
- [x] Add browser tests with a cross-origin fixture page: handshake, instance
      boxes, highlight, scroll, hover, click, in-frame link navigation,
      rejected messages from wrong origins, wrong sources, and wrong nonces.
- [x] Update READMEs, run relevant tests and `cargo xtask check`, commit,
      push, and stop for review.

- [x] Validate compact range parents before numeric conversion; reject broken
      references rather than converting invalid numbers to null.
- [x] Exercise the public same-origin interface's pointer subscriptions and
      pending-operation disposal, alongside the unchanged local shell runtime.
- [x] Capture disposal-after-response and byte-limited usage-map regressions
      before fixing their lifecycle/error handling.
- [x] Preserve body-child selectors by inserting publication metadata into the
      head; cover the unchanged body structure in a regression.
- [x] Prove clipping, occlusion and coalesced events across origins; capture and
      fix text-only range scrolling through nested containers.
- [x] Cover primary/modified/middle and top/parent/blank/named navigation,
      runtime outer-window traps and a real five-second pending-request timeout.
- [x] Validate build-time string/native pooling semantics and enforce the final
      minified inspector budget after all formatting and implementation changes.
- [x] Extend the existing Browse target-preservation unit assertions to include
      the new authenticated link indices without weakening their href/target checks.
- [x] Validate portable repository-preview resources before inspector injection,
      retaining full staged-inventory validation afterward; include the build
      helpers in the isolated example-baseline fixture.

### Milestone 4 implementation notes

Three existing browser assertions (`component_inspector`, `component_workspace`,
`design_links`) required zero script elements in published Browse frames. The
required external inspector injection necessarily adds one script tag. Only those
assertions now require that one package script; generated-document assertions,
sandbox denial, screenshots and existing interactions retain their requirements.
The inert map uses a template so it adds no executable script. No mockup changes
are needed because the local presentation is unchanged.
The existing `browse_document_adapter` unit test also expected target attributes
to end the start tag. Its six exact assertions now include the required link
indices, retaining the original href, target, namespace and degradation checks.

- [x] Prove local shell HTML, generated documents and mobile/desktop screenshots
      match the pre-milestone capture; retain comparison snapshot bytes exactly.
- [x] Cover inspector budget, bundle confinement, release inventory, lifecycle
      failures and current-only metadata injection in focused regressions.
- [x] After checks pass, `git add -A`, commit with Conventional Commits and push.
- [x] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      against the complete local diff from `origin/main`; record numbered
      findings with severity, options and recommendations without changing code.

### Milestone 4 verification notes

The frame interfaces and both adapters are implemented in `src/client`; extraction
into the separate viewer package remains Milestone 5. Local Serve/export retain
their script-disabled sandbox, parent-owned highlighting and existing controls.
Current published copies receive a deferred inspector plus an inert, bounded
range/parent and logical-link map. The map and script are inserted in the head;
generated files and comparison snapshots receive neither. Oversized maps publish
an explicit limit state. The frame/export delivery documents and the client,
inspector, Browse, export and root READMEs describe these boundaries.

Regressions captured invalid compact parent conversion, a resolved reply escaping
disposal, a byte-limited host map throwing the wrong error, body-selector changes,
and text-only scrolling inside an inner container before their fixes. Build-helper
tests also captured strict-directive relocation, native shadowing and delimiter
collisions. The dependency-free IIFE uses ordinary string/native pooling followed
by Terser with no unsafe compression flags or runtime decoder. Its final minified,
uncompressed size is exactly 8,192 bytes, enforced by the package gate.

Focused verification passes 47 Node tests and 14 Chromium tests, with no skips or
intermittent retries. Browser coverage includes null/multiple roots, clipping,
occlusion, highlight pixel preservation, text and element scrolling, hover/click,
Escape, logical targets/modifiers, coalescing, view replacement, disposal, both
five-second timeouts and rejected origin/source/nonce/schema/size inputs. VM traps
exercise outer-window confinement through handshake, navigation and disposal.
The final mobile and desktop screenshots and served shell HTML are byte-identical
to the saved pre-milestone captures. All 277 generated example HTML hashes match;
the export regression separately compares every snapshot HTML file with its
original generated bytes. No comparison or example source files were changed.

The first full gate ran 1,598 Node tests and stopped with 40 failures: one
existing target-attribute assertion, one isolated example fixture missing the new
build helpers, and 38 repository-preview tests sharing a portable-resource
validation failure. Preview now validates copied consumer resources before
inspector injection; final export validation still checks the complete staged
inventory. A new regression also proves unowned consumer scripts cannot gain
root-relative access through that ordering. All six Browse adapter tests, the
isolated example rebuild, and the 45 publication/preview tests pass after these
fixes. One focused preview run correctly rejected source edits made concurrently
with its capture; the independent stable-tree rerun passed both tests.

The final `cargo xtask check` passed all 1,599 Node tests, 290 Chromium tests,
five packed-consumer scenarios and three Rust tests, plus dependency audits,
formatting, lint, typechecking, example validation, the package budget gate,
Clippy and the Rust file-length audit (eight files). No tests were skipped and
no browser retries or intermittent failures occurred in the final gate. The
browser suite took 9.5 minutes. The working tree stayed stable during this run.
All changed source/test files are within 300 lines. Local Markdown links and the
diff were validated; there are no file deletions against refreshed `origin/main`
(`87daaa4`). Implementation commit `6c244bb` was pushed before the review below.
Milestone 3 notes and findings remain byte-unchanged.

### Milestone 4 post-push review

1. **P2 — Viewport-fixed components lose their visible element bounds.**
   [geometry.ts:45](../src/inspector/geometry.ts#L45) skips the measured element
   before recording its fixed positioning. An ordinary overflow ancestor then
   clips a viewport-fixed element even though that ancestor does not clip its
   actual paint. A Chromium probe against the published minified inspector used
   an 80-by-40 overflow-hidden ancestor and a fixed 160-by-40 button at
   `(200, 150)`. Chrome reported that rectangle and hit-tested the button, while
   the adapter returned an empty box array. Adding button text returned only the
   text rectangle. Both adapters' public boundary lists use this reader. Doing
   nothing leaves visible fixed controls unavailable to picking or only partly
   highlighted. **A (recommended):** define and share containing-block-aware
   clipping across adapter measurements and local highlighting, with browser
   regressions for viewport-fixed controls, transformed containing blocks, text
   and nested scrollers. This broader geometry seam prevents the parallel local
   and inspector implementations from drifting; retain the bundle budget and
   existing local visual baselines. **B:** move the fixed-position flag update
   ahead of the skip and add only this regression. That is a smaller patch but
   does not establish which ancestors legitimately clip a fixed descendant.

2. **P2 — Consumer CSS can paint over highlighted component pixels.**
   [overlay.ts:15](../src/inspector/overlay.ts#L15) sets positioning and pointer
   styles on an ordinary `div`, leaving its other computed styles consumer-owned.
   The shadow root isolates the SVG shapes, but not this host. A Chromium probe
   with `div { background: rgb(255, 0, 0) }` gave the host a red 390-by-300
   background; screenshots of the selected button differed before and after
   highlighting because the host painted behind the mask's transparent cutout.
   Doing nothing permits consumer styles to obscure selected content or hide
   the overlay, violating pixel preservation for cross-origin inspection.
   **A (recommended):** establish an explicit style reset for the overlay host
   and test consumer background, display, opacity and box-model rules, including
   important declarations. Keep the shadow root and test original component
   pixels through its cutouts. A scoped presentation boundary plus regressions
   is sufficient; the overlay does not need an architectural replacement.
   **B:** change the host to a custom element to avoid generic `div` selectors.
   That reduces collisions but leaves universal and inherited styles unchecked.

The required prompt reviewed the complete 178-file branch diff at `6c244bb`
against `origin/main` (`87daaa4`) after the implementation push, using
`git diff origin/main...HEAD`. The 180-file tip-to-tip summary additionally
includes main-only release 0.9.0 metadata; no integration or release-metadata
changes were made. Coverage included instance/source capture, catalogue readers
and projection, server/watch/comparison lifecycle, both frame transports,
publication/export, bundle tooling, fixtures, tests and protocol alignment.
The three recorded Milestone 3 findings still await the user's decision and
were not changed or fixed. These two additional findings were confirmed with
isolated browser probes; no implementation or test files changed during review.
Browser verification remains Chromium-only, and the inspector has zero bytes of
headroom under its enforced budget. Recording this review is a documentation-only
follow-up. Milestone 5 has not started.

## Milestone 5: Extract the viewer package (completed)

Tags: ui

Create `@mokly/viewer` and make Serve and export its first hosts.

- [x] Add npm workspaces with `packages/viewer` (`@mokly/viewer`, MIT,
      React peer dependency, ESM, type declarations); extend build, lint,
      typecheck, format, package check, and packed-consumer smoke scripts.
- [x] Move the shell TSX, shell CSS, enhancement runtime, adapters, and
      navigation client modules into the package; the CLI package imports the
      viewer by version and keeps serve, export, build, and comparison code.
- [x] Implement `<MoklyViewer>`: catalogue source handling, controlled and
      uncontrolled selection, every slot, every event, the imperative handle,
      CSS variable theming, and an SSR entry that renders static shell HTML.
- [x] Mount the viewer in Serve and export with no slots and the same-origin
      adapter; Serve's live-update client refreshes the read model and drives
      the viewer's update path.
- [x] Acceptance: the exported example site is functionally identical (byte
      comparison of shell output with justified diffs listed), all existing
      browser tests pass unchanged or with justified edits, and watched-update
      behavior is preserved.
- [x] Add package tests: rendering from a read-model fixture, each slot, each
      event, controlled selection, imperative handle, SSR output, and the
      postMessage adapter against the cross-origin test page.
- [x] Add the package README following the repository README rules and update
      the root README, architecture docs, and protocol delivery statuses.
- [x] Run relevant tests and `cargo xtask check`, commit, push, and stop for
      review.

### Milestone 5 extraction checklist

- [x] Capture the HEAD export, served shell markup, generated-document hashes,
      and mobile/desktop screenshots in `.context/viewer-m5` before edits.
- [x] Move shared browser-safe value types and validators to their real viewer
      owner; replace Node-only hashing in catalogue validation with a tested
      synchronous browser-safe implementation, preserving all digest bytes.
- [x] Keep private controls, on-demand view requests and watched transports in
      the CLI, injected through documented framework-neutral runtime seams.
- [x] Verify effect replay, independent roots, cancellation, source replacement,
      every slot/event/handle operation, and cross-origin React hosting.
- [x] Record every export HTML/CSS/module byte difference and unchanged watched
      browser tests; keep comparison snapshots and inspector bytes unchanged.
- [x] Cover invalid prop selection, idle pick cancellation and shell variant/fragment
      navigation with regressions; preserve safe errors and committed event semantics.
- [x] Consolidate imports at the new owner and split package-manifest and
      registry/classification helpers to keep production files within 300 lines.
- [x] Keep Serve assets independent of catalogue decoding and cache validated
      public revisions for shell requests; re-run latency and full-gate checks.
- [x] Synchronize comparison-recovery coverage with the replacement document's
      load event; preserve every behavior assertion and repeat the regression.
- [x] Keep the catalogue validator off Serve's initial browser module graph;
      prove live recovery boots without it and evidence loads it only on demand.
- [x] Preserve native disclosure interactions made before module initialization
      through preference/recovery restoration; cover deliberately delayed modules
      and retain every existing watch test unchanged.
- [x] After focused checks and `cargo xtask check` pass, `git add -A`, commit
      with Conventional Commits and the requested co-author trailer, and push.
- [x] After that push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      against the complete local diff from `origin/main`; record findings with
      severity, impact, lettered options and recommendations without fixing them.

### Milestone 5 verification notes

The pre-edit baseline is commit `695a856b53e68a987418b15ea0527f0f60751d7e`.
`.context/viewer-m5/baseline/` contains its actual CLI export; shell responses,
generated HTML hashes and 390×844 / 1440×1000 screenshots were captured before
extraction. `after/`, `acceptance.json`, logs and capture/comparison scripts retain
the measured result. No generated example files are tracked: this example uses
derived output. Milestones 1–4 and their review records remain byte-unmodified.

Both packages build with exact dependency `@mokly/viewer: "0.1.0"`. CLI producers
now import browser-safe DTOs/validators from their viewer owner; private controls,
watch, on-demand compilation and repository access stay in the CLI. The public
React/SSR entries and documented `./runtime` / `./data` boundaries are tested from
real tarballs. Source moves used `git mv`; split CSS modules concatenate to the
original bytes. Release configuration, workflows and the publish action are
unchanged for Milestone 6.

Measured export acceptance (uncompressed bytes):

- 1,162 baseline files → 1,169 files: seven added client modules, no removed paths
  except the content-addressed comparison generation relocation.
- All 180 shell HTML files (37,658,133 bytes) match exactly after replacing only
  the owned deployment id and comparison generation id with their new values.
  No markup, copy, geometry, stylesheet or frame-resource change is normalized.
- Standalone CSS remains **41,123 bytes**, SHA-256
  `b5456d7988b623a90ec1457511e6629524599617963711f6bcd2485a0fc96e5f`.
  Fonts and all 277 generated example HTML hashes match the baseline.
- All **608** comparison snapshot/resource files match byte-for-byte at their
  generation-relative paths. `review.json` grows 456,424 → 474,731 bytes solely
  because `changedPaths` records this extraction (178 → 590 paths). Its schema,
  classifications and other fields are identical. That changes the immutable
  generation id; browser-module changes also change deployment identity.
- Catalogue JSON remains 5,417,032 bytes, with only the two owned identities above
  differing. Ownership metadata grows 135,729 → 136,018 bytes for the seven module
  paths; its schema is unchanged. Upload schemas are unchanged.
- Browser inventory: **244,632 → 314,489 bytes** (+69,857), with 49 modules
  unchanged, 14 existing modules changed and seven added. The exact changes follow.
  The additional reader is used by Serve's update bridge; exports do not initiate
  that private transport. No React or hydration enters the standalone graph.
- Inspector stays **8,192 bytes** and byte-identical, SHA-256
  `72f6a1ddf8e23c0ed50901e51b279e1342e6039720b1bb18108aaaa38dc68128`.
- Local screenshots are visually identical, with raster differences confined to
  rounded edges: final mobile capture differs in 16 of 329,160 pixels (maximum
  channel delta 11), and desktop in seven of 1,440,000 (maximum delta one).
  Earlier captures varied between zero/several edge pixels, including an exact
  desktop match and six mobile pixels at delta one. This is not a pixel-exact
  acceptance claim. No pixels were edited or masked. The first capture hit a
  navigation timeout; a longer timeout passed.

All paths in this table are under `__mokly/client/`. Existing paths are retained;
the new module names and delivery behavior are documented in
[`mokly-export-delivery.md`](../docs/protocol/mokly-export-delivery.md).

| Module                     | Before |  After | Reason                                                                         |
| -------------------------- | -----: | -----: | ------------------------------------------------------------------------------ |
| `browse.js`                |  8,583 |    607 | CLI composition injects private services and starts the shared runtime.        |
| `browse_refresh.js`        |  1,794 |  2,738 | Lazy validated adoption with cancellation/navigation fences.                   |
| `browse_runtime.js`        |      0 |  8,612 | Extracted vanilla Browse controller and early native choice restoration.       |
| `browse_state.js`          |  6,641 |  6,739 | Retains early native choices after one-shot reload recovery.                   |
| `catalogue_updates.js`     |      0 | 58,646 | Public revision adoption with bundled browser-safe catalogue validation.       |
| `component_controls.js`    | 13,606 | 13,649 | Uses injected CLI control transport.                                           |
| `control_view_key.js`      |      0 |    146 | Shared pure control-view key helper.                                           |
| `diffs.js`                 | 30,301 | 30,346 | Optional embedding error callback; local behavior retained.                    |
| `early_disclosures.js`     |      0 |  1,791 | Temporary native disclosure capture, restoration and cleanup.                  |
| `frame_mount.js`           |  1,440 |  1,522 | Public cancellation of pending built-in mounts.                                |
| `inspector_tabs.js`        |  2,777 |  2,769 | Accepts the scoped viewer document.                                            |
| `navigation-resize.js`     |  4,335 |  9,103 | Disposable resize setup plus synchronous early disclosure capture/persistence. |
| `post_message_adapter.js`  |  6,622 |  6,788 | Honors optional mount cancellation.                                            |
| `same_origin_adapter.js`   |  9,707 |  9,937 | Mount cancellation and embedding overlay ownership.                            |
| `same_origin_highlight.js` |  5,537 |  5,578 | Appends overlays inside the embedded style scope.                              |
| `same_origin_mount.js`     |  5,879 |  6,092 | Pending mount cancellation and listener cleanup.                               |
| `services.js`              |      0 |    499 | Optional private-host capabilities and lazy revision-adopter loading.          |
| `workspace.js`             |  9,298 |  9,112 | Injected inspection/loading plus extracted workspace helpers.                  |
| `workspace_events.js`      |  1,661 |  1,653 | Uses the scoped viewer document.                                               |
| `workspace_inspection.js`  |      0 |  1,086 | Shared inspection/label/button helpers.                                        |
| `workspace_props.js`       |      0 |    625 | Shared real-props rendering helper.                                            |

Focused validation: **55 Node tests and 21 Chromium viewer tests passed**, with
zero skips. New regressions first reproduced invalid prop-selection crashes,
idle pick cancellation clearing an explicit highlight, and dropped shell
variant/fragment state. New assertions also cover every slot/event/handle,
strict replay, source cancellation/retry, independent roots, safe failures,
controlled round trips, same/cross-origin frames, default-variant events,
source/adapter replacement, host callback exceptions and inherited theming.
A test initially inspected an iframe `src` attribute rather than the actual
`location.replace` destination; it now verifies the loaded document URL. The
accent test similarly now checks documented variables and actual brand colors.

Existing browser test assertions remain unchanged. Import locations changed in
`component_geometry`, `css_screen_evidence`, `design_comparison_eligibility`,
`design_library`, `evidence_workspace`, `frame_adapter`, `same_origin_adapter`
and `review_failure_reload`; `component_design_fixture` uses the new DTO owner.
`frame_adapter_fixture` exposes real public catalogue data and its existing logical
links for embedding tests. `watch.spec.ts` is byte-unmodified. Existing large
legacy test bodies remain intact; all new viewer files and modified production
files are within the 300-line cap.

`review_failure_reload.spec.ts` additionally waits for the replacement document's
load event after observing its new server-rendered version. Its unchanged
assertions had clicked Overlay before the replacement module graph finished
loading (trace: click at 471,305 ms; new event-stream connection at 471,350 ms).
The full run passed 1,632 Node tests and 310/311 browsers; an independent rerun
reproduced this readiness race. The wait uses the actual load lifecycle, with no
sleep, timeout increase or relaxed assertions. This is a justified test-only
synchronization change; all five existing watch tests passed unchanged.
The corrected comparison-recovery test passed five consecutive independent runs
in 22.4 seconds before restarting the complete gate.

That restarted gate passed 1,632 Node tests and the corrected comparison test,
but finished with 310/311 browsers after an intermittent disclosure failure in
`watch.spec.ts` (duplicate titles across reloads). All five tests in that file
passed unchanged on the independent rerun in 25.6 seconds. The retained trace
shows the two native disclosure clicks overlapping the new document's live-state
restoration; the previous full run passed this case. No watch assertions or
timeouts were changed. The next full gate repeated that failure, as recorded below.

The disclosure failure repeated in that full run (again 310/311 browsers), so
an independent pass was not treated as sufficient. Its trace isolated delayed
live-state restoration behind the new eager catalogue-validator import. A new
browser regression first failed with validation unavailable during startup.
The CLI now loads the adopter through a lazy public runtime seam only after an
evidence response arrives, retaining cancellation/navigation checks after the
import. Initial live recovery no longer waits for validation code. The same
regression proves the validator is requested once on demand and evidence applies
without reloading. Six Node checks, the dynamic browser-graph package gate and
nine focused browser cases passed, including all five unchanged watch tests.

Repeated bootstrap/watch coverage then exposed a second startup window: native
summary clicks could precede deferred preference and reload restoration. A new
delayed-module regression failed before the fix. The synchronous bootstrap now
captures those native choices, reapplies them after either restoration, persists
them at load and removes its listeners/attributes on load or exit. Nested
interactive controls and prevented/non-primary clicks are excluded. This passed
34 focused Node tests and 21 browser cases (both bootstrap regressions plus all
five unchanged watch cases, repeated three times). The final cleanup assertions
also passed both bootstrap tests. The watch file remains byte-unmodified.

The first full gate passed 1,626 Node tests, dependency audit, formatting, lint,
typechecks/builds, example validation and every packed-consumer check. It was
deliberately interrupted during browsers after catalogue decoding on every asset
request made example cases take 24–38 seconds. Five regression cases first
reproduced the asset-path bug; assets now bypass catalogue decoding, and shell
requests cache only an unchanged validated serialized revision. The focused
follow-up passed 16 Node and nine unchanged browser tests (0.4–2.8 seconds per
browser case; 21.2 seconds total). The revision-cache test covers replacement,
invalid data rejection and recovery. This was a performance correction, not a
flaky-test retry.

The final `cargo xtask check` passed **1,632 Node tests**, **313 Chromium tests**,
**five packed-consumer scenarios** and **three Rust tests**, with no failures,
skips or retries. The Node suite took 424 seconds and Chromium 10.3 minutes.
All five unchanged watch tests, both startup regressions and the synchronized
comparison-recovery case passed in that complete run. Audit reported zero
vulnerabilities; formatting, ESLint, both TypeScript builds/typechecks, example
validation, package/inspector/browser-graph checks, Rust formatting, Clippy and
the eight-file Rust length audit passed. The tree stayed stable throughout.
The log is `.context/viewer-m5/xtask-check-final.log`.

Markdown validation checked 262 local links; the only missing targets are the two
inspector source links in the intentionally untouched historical Milestone 4
review. Every changed production file meets the 300-line cap. The rename-aware
diff against refreshed `origin/main` (`87daaa4`) has only two deletions:
`src/server/shell/css_chrome.ts` and `css_nav.ts`, whose content now lives in split
viewer modules and retains exactly the original concatenated CSS. Other source
relocations preserve history. No example sources, release configuration or
workflow files changed. Implementation commit `9ad564a` passed these checks and
was pushed before the review below; its remote tracking ref matches the commit.

### Milestone 5 post-push review

1. **P2 — Changing viewport leaves pick mode active without its visuals.**
   [frames.ts:68](../packages/viewer/src/viewer/frames.ts#L68) replaces frame
   sessions when the visible viewport/view changes, but `clear` does not end or
   reset the active `Picking` state. A browser probe started picking on Mobile,
   changed selection to Desktop, and observed the highlight-layer count drop
   from one to zero. Another `startPick()` resolved with zero layers and no new
   start event; no end event had fired. Doing nothing leaves the host believing
   that picking is active while the new frame has no pick mask or activation.
   **A (recommended):** make frame replacement a shared lifecycle boundary that
   ends active/pending picking exactly once and resets inspection state, using
   the documented navigation reason for a view transition. Add same-origin and
   postMessage regressions for viewport, scheme and variant changes, including
   pending activation. This closes the transition class rather than patching one
   toolbar handler. **B:** preserve picking across replacements and explicitly
   reactivate every replacement session before accepting clicks. That offers
   continuity but needs more cancellation/state coordination and a clarified
   event contract.

2. **P2 — A flow fragment is applied to every step.**
   [frames.ts:75](../packages/viewer/src/viewer/frames.ts#L75) assigns the global
   route fragment to every mounted frame, overriding the first-step-only rule
   already used by [public_stage.tsx:128](../packages/viewer/src/viewer/public_stage.tsx#L128)
   and the navigation contract. A browser probe navigated a two-step use case
   to `?fragment=example-anchor`; both frame document URLs acquired
   `#example-anchor`. Doing nothing can scroll later steps to an unrelated
   same-named anchor, making the embedded flow disagree with local Browse and
   the portable fallback. **A (recommended):** resolve per-frame fragment scope
   in one descriptor/URL boundary consumed by both markup and adapter mounting,
   with multi-step same/cross-origin regressions. The existing duplicated
   decisions have already diverged, so sharing this small rule is preferable to
   maintaining another conditional. **B:** guard the assignment with
   `stepIndex === undefined || stepIndex === 0` and add a focused regression;
   this fixes the immediate behavior but leaves the duplicate policy.

3. **P2 — Imperative highlighting loses the requested frame scope for labels.**
   [frames.ts:176](../packages/viewer/src/viewer/frames.ts#L176) stores only the
   instance key after highlighting the requested session; keys intentionally
   remain stable across viewports. [frame_labels.ts:53](../packages/viewer/src/viewer/frame_labels.ts#L53)
   then queries every session with that key. With Both visible, a browser probe
   highlighted the Mobile `action` instance and observed one Mobile mask but two
   `Action · action` label buttons, one on each viewport. Those buttons dispatch
   their respective frame's instance events. Doing nothing presents an
   unrequested Desktop selection target and makes labels disagree with the
   highlighted view. **A (recommended):** retain a typed, frame-scoped highlight
   request through mask, label and event rendering, distinguishing a public
   `InstanceRef` from the workspace's intentional multi-view key highlighting.
   Cover Both, schemes, variants and repeated flow steps across both adapters.
   This modest state-model change prevents scope from being lost in other
   inspection operations. **B:** retain the selected session separately and
   filter label queries to it; this is smaller but requires careful replacement
   invalidation and keeps parallel highlight-state representations.

The required prompt reviewed the complete **590-file** diff at
`9ad564abaeecba73833dd9fcee33028539fd00e0` using
`git diff origin/main...HEAD`, after the push, against `origin/main` (`87daaa4`).
The 592-file tip-to-tip inventory additionally includes pre-existing main-only
release metadata; no integration or release edits were made. Coverage included
source/instance capture, catalogue projection/validation, public Serve/watch and
comparison lifecycles, export ownership and schemas, package/tarball boundaries,
vanilla asset delivery, React source/selection/slot/handle lifecycle, frame
transports, tests, docs and the recorded byte evidence. Focused browser probes
retain their output in `.context/viewer-m5/review-probes.log` and
`review-scope-probe.log`. No implementation or test file changed during review.

The earlier Milestone 3 and 4 review records remain untouched. Their historical
reference, retention, fixed-geometry and overlay-style implementation findings
still await the user's decision. Required Milestone 5 delivery-status updates
supersede the earlier documentation-status observation without rewriting its
historical record. These three new recommendations also await that decision;
none was automatically fixed. Residual verification limits are Chromium-only
browser coverage, the recorded small screenshot raster differences, and zero
inspector budget headroom. The final complete gate remains green; these probes
identify missing behavioral coverage, not a failed gate that was ignored.
Milestone 6 and release automation remain outside this completed milestone.

## Milestone 6: Release preparation and verification (completed)

Prepare both packages to release together from the merge.

- [x] Configure release-please for two components, `@mokly/viewer` starting at
      `0.1.0` and the matching `@mokly/mokly` minor bump; update
      `npm-release.md`, publish action, and release fixtures.
- [x] Extend package checks and smoke tests to pack, install, and exercise
      both tarballs from a clean consumer.
- [x] Run `cargo xtask check`; after it passes, `git add -A`, commit with
      Conventional Commits, and push the branch.
- [x] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

### Milestone 6 verification notes

Release preparation uses two Node components and a combined `node-workspace`
release PR with `updateAllPackages: true`. The viewer manifest starts at 0.0.0;
the feature bump produces its first 0.1.0 release. Independent versions use
`vX.Y.Z` and `viewer-vX.Y.Z` tags, and both tags must identify the same commit.
The CLI's exact viewer dependency and its root lockfile edge update together.

The original 0.9.0 pairing was already taken: read-only checks on 15 September
2026 found `v0.9.0` at `87daaa4` and npm `@mokly/mokly@0.9.0` as `latest`.
The four release-metadata changes from main are preserved, so the next feature
release is CLI 0.10.0 with viewer 0.1.0. No existing tag or published version is
reused. The version clarification was raised while independent work continued.
Viewer npm lookup returned E404; its first publication, organization permissions
and separate trusted publisher remain maintainer work after merge.

The 36 focused release/bootstrap/action tests pass with no skips or retries.
Three regressions were first red: missing manifest validation (two cases) and
rejection of viewer reports by the CLI-only registry guard. The new packed
archive tests additionally reject local dependency links, stale/ranged versions
and modified tarball bytes. Existing bootstrap and action coverage is retained.

`npm run package:check` and `npm run package:smoke` pass, including all five
clean-consumer scenarios and the production dependency audit. SSR renders both
the installed public fixture and the real CLI export; all five viewer entry
points resolve. A local rehearsal with the action's pinned release-please 17.6.0
engine produces one combined PR and real tag names for 0.10.0/0.1.0, a CLI-only
fix at 0.10.1/0.1.1, and a breaking feature at 0.11.0/0.2.0. Both manifests,
changelogs, dependency edges and workspace lock versions update together;
`npm ci --dry-run --ignore-scripts` accepts the rehearsed lockfile. The targeted
JSON updater covers the engine's root-lockfile dependency gap.

The CI workflow already invokes the root workspace build through typecheck and
the complete gate; no additional build step is needed. Four import-order lint
errors in the initial edits were fixed; lint, TypeScript and Markdown checks
pass. `cargo xtask check` passed on 15 September 2026: 1,643 Node tests,
313 Chromium tests and 3 Rust tests, with no failures, retries or skips. The
dependency audit reported zero vulnerabilities; formatting, lint, both package
typechecks/builds, example check, package checks, all five consumer smokes, Rust
formatting/Clippy and the eight-file Rust length audit passed. The example check
validated 278 derived/untracked files. Local tools were Node 24.14.1, npm 11.11.0
and Rust 1.98.1; the pinned CI toolchains remain unchanged.

The exact release-artifact path was also exercised: `scripts/release/pack.mjs`
packed both archives, and `scripts/package-smoke.mjs --artifacts` consumed those
same paths in all five scenarios. The inspector remains 8,192 bytes with SHA256
`72f6a1ddf8e23c0ed50901e51b279e1342e6039720b1bb18108aaaa38dc68128`.
No schema, export layout, inspector budget or viewer implementation changed in
this milestone. Evidence is retained under `.context/viewer-m6/` in
`xtask-check.log`, `focused-final.log`, `package-check.log`, `package-smoke.log`,
`exact-artifacts.log`, `rehearsal.log` and `rehearsed-ci.log`.

Earlier milestone verification notes and findings remain byte-unmodified.
Implementation commit `926f7d40de391e2ee91860b9bc8088105354abc7` was pushed to
`calummoore/tianjin-v6` before the following review. No package was published and
no release tag was created; tag tests use isolated temporary repositories.

### Milestone 6 post-push review

1. **P2 — A later viewer 0.2.0 release will fail the archive regression test.**
   [release_archives.test.ts:67](../tests/release_archives.test.ts#L67) permanently
   treats an exact `0.2.0` CLI dependency as invalid, while its fixture copies the
   repository's current viewer manifest. When release-please advances the viewer
   to 0.2.0, that dependency becomes the correct pair. An isolated real-tarball
   probe using CLI 0.11.0/viewer 0.2.0 confirmed the package validator accepts the
   pair and this assertion fails with `Missing expected rejection.` Doing nothing
   blocks the required CI gate for that release PR even though its version pair
   is correct. **A (recommended):** derive the deliberately mismatched exact
   version from the fixture's viewer version and exercise the archive test with
   both initial and later release versions. This small version-independent test
   boundary protects future release PRs without changing the production validator.
   **B:** freeze both fixture versions independently of the repository manifests;
   this makes the negative case stable but no longer exercises later release
   metadata unless a separate version matrix is added.

2. **P2 — A throwing pick-end callback interrupts viewer teardown.**
   [frames.ts:283](../packages/viewer/src/viewer/frames.ts#L283) emits the host's
   source-change callback before marking the frame manager disposed or clearing
   its sessions. If `onPickEnd` throws during source replacement,
   [runtime.tsx:246](../packages/viewer/src/viewer/runtime.tsx#L246) also exits before
   disposing its workspace, comparison, resize, slot and scoped event resources.
   Isolated Chromium probes using both same-origin and postMessage adapters
   observed one mounted session, zero aborts/unsubscribes/disposals, no remaining
   viewer DOM, and a hover callback still delivered through the old subscription.
   Doing nothing leaks the old adapter/runtime resources and permits callbacks
   after React removes the viewer. **A (recommended):** make teardown exception-safe
   across both ownership layers, ensuring every cleanup runs while preserving the
   original host exception. Add throwing-callback source/adapter replacement
   regressions for both transports. A shared cleanup discipline is warranted
   because guarding only the pick callback leaves the outer runtime vulnerable;
   no viewer architecture replacement is needed. **B:** require hosts to catch all
   callback failures before returning. That reduces local work but leaves the
   library's documented cleanup guarantee dependent on every embedding host.

The required prompt reviewed the complete **618-file** branch diff at `926f7d4`
using `git diff origin/main...HEAD`, after its push, against `origin/main`
(`87daaa424e2d086d94a61d24734932235ad931f1`). The tip-to-tip diff has 617 files;
main's already released 0.9.0 metadata is preserved. The source tree, index and
untracked-file inventory were clean when review began. Coverage included release
selection and tag identity, workspace version/lockfile updates, bootstrap and
registry guards, both packed manifests/consumers, source/instance capture,
catalogue privacy/projection, Serve/watch and comparison lifecycle, export
ownership, vanilla asset delivery, React/frame cleanup, tests and protocol/docs
alignment. Existing CSS module removals are the prior extraction's split modules;
Milestone 6 introduces no source, test or feature deletion.

The two findings were confirmed without changing implementation or test files.
Evidence is in `.context/viewer-m6/review-version-probe.log` and
`review-callback-probe.log` (one future-version archive probe and two adapter
lifecycle probes). They identify missing behavioral coverage after the complete
gate passed; no failed gate or flaky retry was ignored. The seven earlier P2
implementation findings remain unresolved, and every earlier review record is
unchanged. All recommendations await the user's decision. Residual verification
limits are Chromium-only browser coverage, local Node 24 rather than CI's full
runtime/platform matrix, zero inspector budget headroom, and no live npm/OIDC or
GitHub protection mutation. Recording this review is a documentation-only
follow-up; publication and published-package verification remain post-merge.

## Milestone 7: Review follow-up fixes (completed)

Implement the user's approved option A for all ten Milestone 3–6 findings.
Preserve earlier review records, local Serve/export presentation, comparison
snapshot bytes and public schema versions. Add a failing regression before each
bug fix; record the addressing commit for every finding below.

- [x] M3-1: Centralize historical-reference availability in catalogue projection;
      publish unavailable usage for omitted component metadata and cover id and
      route reuse in Serve and export without weakening the reader.
- [x] M3-2: Add a non-renewing generation lookup for alias pruning; prove expiry
      during repeated complete captures with a controlled clock.
- [x] M3-3: Audit runtime catalogue delivery status and correct stale paragraphs.
- [x] M4-1: Share containing-block-aware clipping between local and in-frame
      geometry; cover fixed, transformed and nested-scroll instances.
- [x] M4-2: Isolate overlay host and nodes from consumer CSS; verify preserved
      highlighted pixels under hostile universal, inherited and important rules.
      First absorb changes through safe minification/pooling within 8,192 bytes;
      only if impossible, document and enforce the smallest fitting round budget.
- [x] Keep the reset SVG pointer-inert; reproduce and cover hover/click
      delivery under every hostile-style case before the correction.
- [x] M5-1: End active or pending picking once at frame replacement with the
      navigation reason and reset inspection; test viewport, scheme and variant
      transitions on both adapters, including pending activation.
- [x] Retain a mount failure as the pending pick's cancellation cause;
      reproduce and prevent duplicate error notifications for one failure.
- [x] M5-2: Resolve first-step-only flow fragments at a shared descriptor/URL
      boundary used by markup and mounts; test multi-step flows on both adapters.
- [x] M5-3: Preserve typed public InstanceRef frame scope through masks, labels
      and events, separately from workspace multi-view highlighting; cover Both,
      schemes, variants and repeated flow steps on both adapters.
- [x] M6-1: Derive deliberately mismatched archive versions from real package
      metadata and exercise initial and later release versions.
- [x] M6-2: Guarantee frame/runtime teardown despite host callback exceptions,
      preserve the original exception, and test disposal and callback fencing on
      both adapters during source/adapter replacement.
- [x] Stress cleanup with 20,000 actions, multiple failures and an undefined
      thrown value; drain iteratively without masking the first exception.
- [x] Update relevant READMEs and protocols; audit catalogue/viewer/frame delivery
      status references and verify earlier milestone records remain unchanged.
- [x] Replace the existing async adapter test's one-frame wait with explicit
      installation/attempt signals while retaining every behavioral assertion.
- [x] Wait for the cross-origin flow click event before asserting its payload;
      retain the existing scope checks and assert the public step index too.
- [x] Run focused tests, local Serve/export smoke and byte comparisons, then
      `cargo xtask check`; fix failures and record counts, retries and skips.
- [x] After checks pass, `git add -A`, commit with Conventional Commits (title
      at most 50 characters, body naming all findings and the Codex co-author
      trailer), and push `calummoore/tianjin-v6`.
- [x] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      against the complete local diff from `origin/main`; record numbered findings
      with severity, impact, lettered options and recommendations without fixing.

### Milestone 7 verification notes

Baseline: `fcfb09c`. Inspector: 8,192 minified, uncompressed bytes; budget 8 KiB.
Verification evidence is retained under `.context/viewer-m7/`.

Implementation commit: `a8f212231b5e8de77ab1032183a2b66648260839`,
`fix(viewer): resolve review follow-ups`, pushed to `calummoore/tianjin-v6`
after the final complete gate passed. Each approved finding is addressed there:

- **M3-1:** retained-component projection and four id/route-reuse Serve/export
  regressions; commit `a8f2122`.
- **M3-2:** non-renewing generation presence lookup and two controlled-clock
  retention regressions; commit `a8f2122`.
- **M3-3:** runtime/component-explorer delivery-status audit and documentation
  clarification; commit `a8f2122`.
- **M4-1:** shared clipping rules and eight fixed/text/transformed/inner-scroll
  browser regressions across both adapters; commit `a8f2122`.
- **M4-2:** isolated host/SVG presentation and three hostile-CSS pixel and pointer
  regressions, with the measured 9 KiB budget; commit `a8f2122`.
- **M5-1:** frame-replacement pick/reset boundary and twelve active/pending
  browser cases, plus the pending mount-error unit regression; commit `a8f2122`.
- **M5-2:** shared first-step-only fragment resolution and two multi-step browser
  cases spanning both adapters and schemes; commit `a8f2122`.
- **M5-3:** typed public frame scope for masks, labels and events, with six browser
  cases covering Both, variants, schemes and repeated steps; commit `a8f2122`.
- **M6-1:** archive mismatch versions derived from real metadata and a release
  matrix including viewer 0.2.0 and 1.4.7; commit `a8f2122`.
- **M6-2:** exception-safe frame/runtime cleanup, four browser replacement cases
  and two cleanup unit cases including 20,000 actions; commit `a8f2122`.

The ten recommended options A were approved together. This follow-up therefore
groups the cross-cutting bug fixes without reopening earlier completed milestones
or adding product design work. Earlier milestone notes and reviews stay unchanged.
M3-3's two cited runtime paragraphs were already corrected by Milestone 5; the
delivery-status audit confirms them and removes the remaining "upcoming viewer"
wording from the component explorer. No regression test is needed for that
documentation-only finding.

Inspector budget: **8,192 → 8,733 bytes**, uncompressed, after shared fixed
containing-block clipping and consumer-style isolation. Twenty-eight minifier
experiments varied string-pool thresholds and safe compression passes/options;
the smallest result was 8,711 bytes, still above 8 KiB. Keep the established
minifier settings and use the smallest fitting whole-KiB budget, **9 KiB (9,216
bytes)**, in the protocol, package gate and inertness regression. No decoder,
unsafe compression, protocol-limit relaxation or runtime import was introduced.
The extra 541 bytes implement the required geometry and presentation boundaries;
measured headroom is 483 bytes. `minify-probe.log` and `minify-probe-final.log` retain both sets of experiments.

Regressions first reproduced all implementation findings: four id/route-reuse
Serve/export cases, controlled-clock alias expiry, future viewer 0.2.0 archive
pairing, fixed/text/transformed geometry, hostile CSS, pick replacements, flow
fragment leakage, highlight scope and throwing-callback teardown. The nested
component variant fixture was corrected to contain real inspectable children;
leaf components intentionally have no nested usage. A cleanup stress regression
also caught recursive cleanup exhausting the stack; cleanup now drains owners
iteratively, preserves even an undefined thrown value, and handles 20,000 actions.
Initial test fixtures also needed a string-returning whole-document page and a
configured Serve comparison source. These were fixture corrections, not retries
of intermittent product failures. Chromium's nested-opacity text compositing
varied by one channel value; the hostile-style fixture isolates div opacity while
retaining universal background/box-model rules and a separate inherited-opacity
case, so all selected-pixel comparisons remain exact.

Focused verification passed: **102 Node tests** and **35 new Chromium browser
cases**, with no skips or retries. TypeScript and lint pass. The browser matrix
covers both adapters for clipping, replacement, fragment scope, scoped highlights
and callback-safe teardown; hostile-style cutouts are pixel-exact.

The initial real Serve capture preserved both mobile and desktop response HTML exactly;
the mobile PNG is byte-identical. Desktop differs at seven rounded-edge pixels
by one channel value, with no layout or meaningful visual change. Export has
1,169 files with no additions/removals: 982 are byte-identical and 182 differ
only by the exact owned deployment/comparison identities. All **608 comparison
snapshot/resource files** and **277 generated HTML hashes** match exactly, as do
shell CSS and fonts. The other five files are four changed client bundles and
`review.json`'s real changed-path inventory. Identity normalization uses only the
two ids read from each catalogue, never a generic hash substitution.
`byte-comparison.json` records paths and pixel evidence. A repeat capture with
identical code varied at four desktop pixels by one channel value, confirming
rasterization noise; mobile remained exact.

The final fetch advanced `origin/main` from `87daaa4` to `7ca301c` (the Mokabook
consumer patch). Main's 19 added paths are absent from this older branch but are
not branch deletions; the merge-base diff still deletes only the two CSS modules
already split during the approved viewer extraction. Milestone 7 deletes no
files or features. A read-only merge preview identifies 12 conflicts for a future
main integration; this follow-up does not silently resolve or discard that
independent work. The final review uses the fetched `origin/main` and records
this integration limit explicitly.

The first complete gate passed 1,654 Node tests and all five packed-consumer
scenarios, then reported 344 browser passes and four failures. Three failures
shared a real overlay regression: `all: initial` restored SVG pointer handling,
which intercepted consumer hover/clicks. One independent retry reproduced it.
The hostile-CSS tests were extended with real hover/click assertions; all three
failed before the SVG explicitly restored `pointer-events: none`. No force-click
or weaker assertion was used. The other failure came from an existing async
adapter fixture assuming one animation frame completed a React adapter swap;
it passed all three independent repetitions. That fixture now waits for actual
adapter subscription/mount attempts. The final full gate reruns all checks after
these corrections; no failed result is treated as success.

The broader affected-browser run then exposed two additional fixture/edge cases.
Universal padding/borders made the fixture's unrelated inline multi-root component
overlap the selected button's bottom seven pixels. Geometry correctly excluded
those occluded pixels; the overlay regression now uses one unoccluded target
and keeps exact, full-interior pixel equality plus hover/click assertions. The
explicit adapter-attempt signal also reproducibly started picking before the
failed mount settled, exposing duplicate reports for the mount error and its
synthetic cancellation. A new unit regression failed first; pending cancellation
now carries the originating failure so mount and handle share one report.

Once pointer delivery worked, the existing flow-event test intermittently read
its callback array before the postMessage arrived (two independent repetitions
passed and one failed). It now polls the actual event and also checks the public
`InstanceRef.stepIndex`; no timeout increase or retry policy change is used.

After the full-gate follow-ups, **103 focused Node tests** and **70 affected
Chromium tests** pass with no skips or retries, including all 35 new browser
cases and the strengthened existing interactions. Lint and TypeScript pass.
Final Serve HTML, shell CSS/fonts, all 608 comparison files and all 277 generated
HTML hashes remain unchanged. Final visual captures differ only at rounded edges:
mobile 19 pixels (maximum channel delta 11), desktop four pixels (delta 1).
A repeated final capture has mobile 16 differing pixels and an exact desktop PNG;
comparing those identical-code captures changes three mobile/four desktop pixels
by at most one channel value. No layout, text, style or interaction change is
visible. Both the initial exact mobile capture and these residual raster details
are retained; `byte-comparison-final.json` records the final artifact comparison.
Inspector SHA256: `1952cf0499da61d8041a88c2dd18e9525eebd947c3985f3f53ec7a9c157bb7b0`.

Final `cargo xtask check` **passed** on 16 September 2026: **1,655 Node tests,
348 Chromium tests and 3 Rust tests**, zero failures, retries, skips or ignored
tests. Audit reports zero vulnerabilities. Both package builds/typechecks,
formatting, lint, example check (278 files), package inventories, all five clean
packed-consumer scenarios, Rust formatting/Clippy and the eight-file Rust length
audit pass. The Node suite took 405.4 seconds and browser suite 10.3 minutes.
The earlier gate failure and independent diagnostic repeats are recorded above;
the final run is complete and green. Logs: `xtask-check-first.log`,
`xtask-check-final.log`, `focused-node-final.log`, `affected-browser-green.log`,
`hover-retry.log`, `async-retry.log`, `flow-retry.log` and the red regressions.

Changed Markdown passes Prettier and `git diff --check`. All changed code files
remain below 300 lines. The local-link audit checked 226 links; the only two
unresolved paths are the immutable Milestone 4 review's historical pre-extraction
`src/inspector` references. Earlier milestones and the post-merge section remain
byte-identical. No new mockup or schema version was introduced.

### Milestone 7 post-push review

1. **P2 — A scoped highlight still depends on unrelated unavailable views.**
   The public `highlightInstance` handle addresses one viewport/scheme/variant/
   step. However, [frame_labels.ts:55](../packages/viewer/src/viewer/frame_labels.ts#L55)
   queries every session's instance boundaries before filtering by that scope;
   [frame_highlights.ts:56](../packages/viewer/src/viewer/frame_highlights.ts#L56)
   supplies all sessions. With Both visible, ready Mobile usage and pending
   Desktop usage, a valid Mobile highlight rejects with a frame error and renders
   no host labels. Both real adapters reproduced the rejection; the same-origin
   probe also retained the Mobile mask after rejection. Doing nothing prevents
   inspection of a ready target whenever unrelated visible evidence is pending
   or unavailable. **A (recommended):** select sessions from the typed request
   before waiting for readiness or measuring geometry; clear unrelated masks
   without querying their unavailable usage. Share scope selection across masks,
   labels and asynchronous work, and add pending/unavailable sibling-view tests
   for both adapters. This modest shared boundary prevents the same coupling
   across inspection consumers; filtering labels alone is insufficient.
   **B:** catch each unrelated measurement failure while rendering labels. This
   is narrower but retains unnecessary waits and can conceal real target errors.

2. **P2 — A late geometry failure from an old frame cancels replacement picking.**
   [frames.ts:113](../packages/viewer/src/viewer/frames.ts#L113) sends every label
   refresh rejection to `fail`, which ends the currently active pick.
   [frame_highlights.ts:52](../packages/viewer/src/viewer/frame_highlights.ts#L52)
   fences successful rendering by request revision but does not fence error
   effects. Controlled probes wrapped both real adapters to hold an old Mobile
   geometry measurement, replaced it with Desktop, started a fresh pick, then
   rejected the old measurement as disposed. The correct start/end(navigation)/
   start sequence gained an erroneous end(error) and `onError`, and replacement
   labels were cleared. Doing nothing lets an ordinary asynchronous replacement
   race interrupt newly activated picking and report an unrelated frame error.
   **A (recommended):** apply generation/request ownership checks to both success
   and error effects across asynchronous inspection paths. Obsolete caller-owned
   promises should still settle appropriately, but stale internal work must not
   mutate current picking or report against its replacement. Add delayed-failure
   replacement regressions for both adapters. A shared ownership rule also
   protects workspace/highlight paths that use the same error handling and avoids
   repeated one-off guards. **B:** guard only this geometry catch against the
   current frame. This fixes the demonstrated trigger with less code but leaves
   analogous inspection error paths exposed.

The required prompt reviewed the complete **634-file** branch diff at `a8f2122`
after its push, using `git diff origin/main...HEAD` against fetched `origin/main`
(`7ca301c04ca898db6ff60b110beb213ec740b004`). Scope: 313 modified, 213 added,
106 renamed and two deleted paths, with 23,573 insertions and 3,403 deletions.
The worktree, index and untracked-file inventory were clean when review began.
Coverage included source capture and identity, comparison attribution, catalogue
projection/privacy/strict reading, Serve/watch and generation retention, export
ownership and inspector publication, both adapters and message validation,
viewer source/routing/frame/pick/highlight lifecycles, release version/archive
pairing and workflows, tests, generated output and protocol alignment.

These two new findings were confirmed without changing implementation or test
files. Ignored review evidence is in `.context/viewer-m7/review-highlight-probe.mjs`
and `.log`, plus `review-stale-geometry.mjs` and `.log`; each probe exercised both
adapters. They expose additional missing coverage after the complete gate passed.
All ten previously approved findings are addressed in the implementation commit;
the two new recommendations are recorded for the user's decision and have not
been applied. Recording this review is a documentation-only follow-up.

Residual verification limits: browser coverage is Chromium-only, the local gate
used Node 24 rather than CI's entire runtime/platform matrix, and live npm/OIDC
publication and GitHub protection changes were not exercised. The inspector has
483 bytes of budget headroom. Main advanced independently; its 19 new paths are
not branch deletions, and the read-only merge preview reports 12 conflicts that
must be resolved before integration. No merge/rebase or mainline feature removal
was performed. The plan stays active until the implementation PR merges;
publication remains the non-blocking follow-up below.

## Milestone 8: Inspection scope and ownership fixes (completed)

Implement the approved option A for both Milestone 7 findings. Share request
scope and asynchronous ownership across inspection consumers while preserving
local Serve/export presentation, shell and comparison bytes, inspector bytes and
public schemas. Earlier milestone notes and findings remain unchanged.

- [x] M7-1: Add failing same-origin and postMessage regressions for pending and
      unavailable sibling views with Both visible; select typed request sessions
      before readiness or geometry, share scope across masks and labels, and clear
      unrelated masks without inspecting their usage, including rejection cleanup.
- [x] M7-2: Add failing delayed-failure replacement regressions on both adapters;
      fence success and error effects for label refresh, highlight, scroll and
      geometry work by request/generation ownership. Settle obsolete caller
      promises with `disposed` without changing replacement picking, labels or
      events. Clarify scope and ownership in viewer/frame protocols and README.
- [x] Verify callback installation in the existing lifecycle test after its
      intermittent one-animation-frame wait; preserve exception identity and
      no-error assertions.
- [x] Run focused tests and smoke/byte checks, then `cargo xtask check`; fix all
      failures and record counts, retries, skips and inspector size.
- [x] After checks pass, `git add -A`, commit with Conventional Commits (title
      at most 50 characters, body naming both findings and ending with the Codex
      co-author trailer), and push `calummoore/tianjin-v6`.
- [x] After the push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      against the complete local diff from `origin/main`; record numbered findings
      with severity, impact, lettered options and recommendations without fixing.

### Milestone 8 verification notes

Baseline: `80d151b995dbc78382451c0045674d2d30e0770c`. Evidence is retained
under `.context/viewer-m8/`. Earlier milestone records and the post-merge section
are byte-identical. Refreshed `origin/main` remains `7ca301c`; no merge or rebase
was performed, and this milestone removes no files or features.

M7-1 uses one captured typed inspection scope for readiness, masks, labels,
geometry refreshes and scrolling. Unrelated mounted masks receive only the off
operation; pending unrelated mounts are not awaited. Six new browser cases cover
pending/unavailable usage and delayed mount completion across both real adapters,
including target success, labels, scroll, geometry, no unrelated measurement or
error, and partial-mask cleanup after a current failure.

M7-2 uses cancellable request ownership around both success and error effects.
Superseded caller promises reject with the existing `disposed` code immediately,
even when a custom adapter has not settled. Internal cancellation is distinct
from a current adapter failure, preserving valid error reports. Thirty-two new
browser cases exercise delayed success/failure in geometry, label, highlight and
scroll work across both adapters, frame replacement and a new pick on the same
frame. They assert exact pick/error sequences and preservation of replacement
label nodes. Five new Node cases cover cancellation, queued work, late completion
and current-error reporting. Viewer/frame protocols and the package README now
define these scope and ownership rules; no schema or adapter wire field changed.

The original implementation failed 20 of the initial 22 browser regressions;
the two passing cases were late-geometry-success controls. The pending-pick unit
regression also failed before its fix. The first follow-up browser run passed
19/22: automatic geometry pulses consumed a measurement intended for a caller
and legitimately replaced label nodes. The fixture now forwards real adapter
operations while triggering geometry explicitly, so each held operation has one
known owner. All original assertions remain, including label-node identity.
The initial 22 cases then passed before expanding to the 38-case matrix.

Focused verification passes **60 Node tests and 110 Chromium browser tests**,
including all 38 new browser cases, with no skips or retries in the final runs.
The first broad browser run passed 109/110: the existing callback-exception test
started picking before its callback update had rendered. Three independent
unchanged repetitions passed. Its one-animation-frame assumption now waits for
the actual slot update committed with the callback; exception identity and
no-error assertions remain unchanged. The full 110-case rerun is green.
Build, lint, TypeScript, changed Markdown and `git diff --check` pass. All changed
TypeScript files stay within 300 lines. The local-link audit checked 52 links;
only the two immutable Milestone 4 pre-extraction inspector links are unresolved.

Inspector source and output remain byte-identical: **8,733 bytes**, within the
**9,216-byte** budget (483 bytes of headroom), SHA-256
`1952cf0499da61d8041a88c2dd18e9525eebd947c3985f3f53ec7a9c157bb7b0`.
No client-adapter, inspector, shell, stylesheet, example or snapshot source was
changed. Actual Serve mobile/desktop HTML matches exactly. The mobile screenshot
is byte-identical; desktop differs at three rounded-edge pixels by one channel
value. Visual smoke inspection found no layout or interaction change.

Export retains 1,169 files: 986 byte-identical, 182 differing only in the exact
owned deployment/comparison identities, and `review.json` reflecting the real
changed-path inventory. There are no added/removed artifact paths. All **608
comparison snapshot/resource files** and **277 generated HTML documents** match
exactly; shell markup, CSS, fonts and every standalone client module are unchanged.
`byte-comparison-final.json` records identities, path comparisons and pixel data.
Logs include `red-browser.log`, `red-picking.log`, `focused-node-final.log`,
`affected-browser-final.log`, `callback-retry.log` and the Serve/export captures.

The final `cargo xtask check` **passed** on 16 September 2026: **1,660 Node
unit/integration tests, 386 Chromium tests and three Rust tests**, with zero
failures, retries, skipped or ignored tests. The Node suite took 412.7 seconds;
Chromium took 10.8 minutes. All five packed-consumer scenarios, dependency audit
(zero vulnerabilities), formatting, lint, both package builds/typechecks, example
validation (278 files), package checks, Rust formatting/Clippy and the eight-file
Rust length audit pass. The tree stayed stable throughout this complete run.
The earlier focused fixture failures and three independent diagnostic repeats
are recorded above; no failed gate was treated as success. Full log:
`.context/viewer-m8/xtask-check.log`.

Implementation commit `11818b0981c64faad73d149df8929429026ed770`,
`fix(viewer): scope inspection ownership`, addresses both M7-1 and M7-2 and was
pushed before the following review. All six new source/test files are tracked in
that commit. No implementation or test files changed during the review.

### Milestone 8 post-push review

1. **P2 — Automatic pointer inspection still reports errors from unrelated
   unavailable views (M8-1).** The explicit scoped highlight now succeeds with
   Both visible and ready Mobile/pending or unavailable Desktop usage. However,
   every mounted frame subscribes to pointer inspection: the same-origin path
   enables it whenever any subscriber exists
   ([same_origin_mount.ts:102](../packages/viewer/src/client/same_origin_mount.ts#L102))
   and measures on pointer movement
   ([same_origin_pointer.ts:21](../packages/viewer/src/client/same_origin_pointer.ts#L21)).
   The postMessage adapter likewise requests every event regardless of usage
   ([post_message_adapter.ts:88](../packages/viewer/src/client/post_message_adapter.ts#L88))
   and rejects returned sibling keys against its unavailable usage. Both paths
   reach the viewer's unscoped error event handler
   ([frames.ts:109](../packages/viewer/src/viewer/frames.ts#L109)). Four read-only
   Chromium probes highlighted Mobile successfully with zero errors, then hovered
   the actual Desktop button. Each produced one `onError` while the valid Mobile
   label remained. Doing nothing lets ordinary pointer movement repeatedly show
   hosts an inspection failure even though the requested target is available.
   **A (recommended):** gate automatic pointer measurement/subscriptions by
   validated inspection availability in both adapters, keeping navigation
   subscriptions usable for unavailable usage; share that capability rule and add
   Both-view hover/click and navigation regressions. This addresses the automatic
   inspection boundary rather than hiding its downstream errors and can retain
   the wire schema and inspector bytes. **B:** ignore error events from frames
   outside the current highlight scope in `ViewerFrames`; this is smaller but
   leaves unnecessary measurement and can conceal unrelated transport failures.

The required prompt reviewed the complete **640-file** branch diff at `11818b0`
after its push using `git diff origin/main...HEAD`, against `origin/main`
(`7ca301c04ca898db6ff60b110beb213ec740b004`). The inventory contains 313 modified,
219 added, 106 renamed and two deleted paths, with 24,375 insertions and 3,403
deletions. Worktree, index and untracked-file inventory were clean at review
start and after the probes. Coverage included source/identity capture, catalogue
projection and strict reading, historical references and retention, Serve/watch
and export ownership, browser/React package boundaries, both frame transports,
request/pick/source lifetimes, release/archive pairing, tests and protocol/docs
alignment. The two deletions remain the earlier approved CSS module split;
main-only additions were not integrated or deleted by this milestone.

The four automatic-pointer probes are in
`.context/viewer-m8/review-pointer-scope.mjs` and `.log`; full-diff inventories
and the patch are retained beside them. This is a newly confirmed event-path
coverage gap after the complete gate passed, separate from the explicit-request
and obsolete-work regressions that now pass. No finding was automatically fixed.
The recommendation awaits the user's decision. Residual limits remain
Chromium-only browser coverage, local Node 24 rather than the full CI platform
matrix, and no live npm/OIDC publication or GitHub protection mutation. The
inspector retains 483 bytes of headroom. Recording the review is a documentation-
only follow-up; the plan remains active until its PR merges.

## Milestone 9: Automatic inspection readiness (completed)

Tags: ui

Address M8-1 with the approved option A: enable automatic inspection only for
ready frame usage, preserving navigation and activating inspection after evidence
updates without remounting the frame.

- [x] Define the readiness and update contract in the viewer/frame protocols and
      viewer README, retaining the existing wire schema and inspector bytes.
- [x] Add failing regressions first, then gate automatic hover/click subscriptions
      and their geometry measurement in both adapters. Cover Both with pending
      and unavailable siblings, successful scoped highlights, no unrelated errors
      or instance events, working sibling links, and readiness updates without
      remounting; retain ready-frame picking and scrolling.
- [x] Cover usage-update cancellation, failure recovery and custom-adapter
      fallback while retaining the existing session ownership rules.
- [x] Update the plan index to reflect this milestone's implementation and review.
- [x] Run focused tests and `cargo xtask check`; record counts, retries and skips,
      inspector size, and unchanged Serve/export shell and comparison bytes.
- [x] After checks pass, run `git add -A`, commit with Conventional Commits and
      the requested co-author trailer, and push the branch.
- [x] After that push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      against the complete local diff from `origin/main`; record each finding
      with severity, impact, lettered options and a recommendation without fixing.

### Milestone 9 verification notes

The baseline is `6a98685` on `calummoore/tianjin-v6`. Earlier milestone notes and
findings remain byte-identical. Refreshed `origin/main` remains `7ca301c`; no merge
or rebase was performed. This milestone removes no files, tests or features.

M8-1 uses the shared validated-usage event capability in both adapters. Pending,
unavailable or over-limit usage retains navigation alone; pointer input cannot
start inspection measurements or emit instance events. Ready usage retains all
existing inspection operations. Optional `MountedFrame.updateUsage` refreshes
the built-in adapters' evidence and subscriptions on the same document. The
viewer frame update path adopts this capability for unchanged document identities;
older custom adapters retain replacement mounts. Cancellation fences update
completion and failures, and later evidence can retry a failed update. Wire and
catalogue schemas are unchanged. Both viewer protocols and both viewer/client
READMEs explain the readiness and update rules; the plan index is current.

Twelve new Chromium regressions cover pending/unavailable usage on both adapters:
Both-visible scoped highlighting, sibling hover/click without errors or instance
events, actual `onScreenNavigate`, no early geometry measurement, readiness
promotion on the same document, ready hover/click/scroll/pick, and navigation
after disabling inspection again. Document handles and mount counts detect
reloads. Five new Node tests cover custom-adapter fallback, changed-document
replacement, cancelled success/failure and recovery from a current update error.

Before the corresponding fixes, all four viewer pointer cases and all four
adapter readiness cases failed on unwanted events; all four viewer-update cases
failed because the document reloaded. The failure-recovery unit test also failed
before its fix (the other four ownership/fallback cases were controls). An initial
test syntax error and Playwright serialization typings were corrected before
validation; no existing tests or assertions were removed or relaxed.

Focused checks passed **65 Node tests and 111 Chromium tests**, with no skips or
retries. The final `cargo xtask check` passed on 16 September 2026: **1,665 Node
tests, 398 Chromium tests and three Rust tests**, with zero failures, retries,
skips or ignored tests. Node took 412.7 seconds and Chromium 11.1 minutes. All five
packed-consumer scenarios, dependency auditing (zero vulnerabilities), formatting,
lint, package builds/typechecks, example validation (278 files), package checks,
Rust formatting/Clippy and the eight-file Rust length audit passed. The working
tree stayed stable throughout the complete gate. New/changed TypeScript files
remain below 300 lines. Changed Markdown, 29 local documentation links and
`git diff --check` were validated separately.

Inspector source and output remain byte-identical: **8,733 bytes** of the
**9,216-byte** budget, with 483 bytes of headroom and SHA-256
`1952cf0499da61d8041a88c2dd18e9525eebd947c3985f3f53ec7a9c157bb7b0`.
No inspector, shell, stylesheet, example or snapshot source changed. Actual Serve
mobile/desktop HTML and screenshots match exactly, with zero differing pixels;
visual inspection confirms unchanged presentation.

Export retains all 1,169 paths: 982 byte-identical files, 182 differing only in
owned deployment/comparison identities, four changed adapter bundles and the
expected `review.json` changed-path inventory. All **180 shell HTML files** retain
identical markup after replacing only those identities. All **608 comparison
snapshot/resource files** and **277 generated HTML documents** match exactly.
The changed bundles are `frame_usage.js` (4,060 → 4,238 bytes),
`post_message_adapter.js` (6,788 → 7,167), `same_origin_adapter.js`
(10,480 → 10,925), and `same_origin_mount.js` (6,092 → 6,269). No schema changed.

Evidence is retained in `.context/viewer-m9/`: red regression logs, focused logs,
`xtask-check.log`, Serve captures, both exports and `byte-comparison-final.json`.

Implementation commit `7b0203f65a92076f869240168c3269af8a98bb65`,
`fix(viewer): gate automatic inspection`, was pushed before the following review.
All five new test/fixture files are tracked in that commit. No implementation or
test files changed during review.

### Milestone 9 post-push review

1. **P2 — Ready evidence refresh can leave picking active without its masks
   (M9-1).** The new same-document update path calls `updateUsage` for replaced
   usage objects, including equivalent ready evidence
   ([frame_session.ts:104](../packages/viewer/src/viewer/frame_session.ts#L104)).
   Both built-in adapters clear their inspection presentation during that call
   ([same_origin_adapter.ts:85](../packages/viewer/src/client/same_origin_adapter.ts#L85),
   [post_message_adapter.ts:109](../packages/viewer/src/client/post_message_adapter.ts#L109)),
   while [frames.ts:72](../packages/viewer/src/viewer/frames.ts#L72) retains the
   existing pick and host-label owners. Two Chromium probes, one per adapter,
   promoted the sibling to ready, started picking with Both visible, then supplied
   cloned ready usage through `ViewerFrames.update`. Both changed from two masks
   and two labels to zero masks and two labels, with picking still active and no
   remount. Calling `startPick` again retained that broken state because
   [picking.ts:17](../packages/viewer/src/viewer/picking.ts#L17) returns immediately
   for an active pick. Doing nothing leaves users with labels but no required
   inspection mask after an ordinary evidence refresh, and hosts cannot restore
   it by starting pick again.
   **A (recommended):** make evidence adoption participate in the existing
   inspection ownership lifecycle. Preserve or reapply valid masks, labels and
   active picking when equivalent ready usage arrives; explicitly cancel and
   clear invalidated inspection when availability or identities change. Add
   both-adapter regressions for ready-to-ready evidence during active picking and
   capability loss. A shared lifecycle rule protects all presentation owners and
   asynchronous refreshes; fixing only the mask would leave state/label drift.
   **B:** conservatively end picking and clear all inspection before every changed
   usage update, while retaining the iframe. This is smaller but discards valid
   inspection state on otherwise harmless evidence revisions.

The required prompt reviewed the complete **645-file** branch diff at `7b0203f`
after its push against `origin/main` (`7ca301c04ca898db6ff60b110beb213ec740b004`),
using `git diff origin/main...HEAD`. The inventory contains 313 modified,
224 added, 106 renamed and two deleted paths, with 25,203 insertions and 3,403
deletions. Worktree, index and untracked-file inventory were clean before and
after review. Coverage included source/instance capture, catalogue projection and
strict reading, public comparison identity/retention, Serve/watch and export
lifecycle, generated-output ownership, browser/React package isolation, both frame
transports, request/pick/source lifetimes, release/archive pairing, tests and
protocol alignment. The two branch-diff deletions are the earlier approved CSS
split. Tip-to-tip main-only differences also predate this milestone; no main
integration or new deletion was performed.

The confirmed probes and their output are retained in
`.context/viewer-m9/review-evidence-pick.mjs` and `.log`, beside the full-diff
inventory and patch. This finding concerns refreshing already-ready evidence
during active picking, beyond the pending/unavailable promotion covered by the
new regressions. It was recorded without fixing; the recommendation awaits the
user's decision. Earlier milestone findings and notes remain unchanged.
Residual limits are Chromium-only browser coverage, local Node 24 rather than
the full CI platform matrix, and no live npm/OIDC publication or GitHub protection
mutation. Recording this review and updating the plan index are documentation-only
follow-ups; the plan remains active until its PR merges.

## Milestone 10: Evidence updates during inspection (completed)

Tags: ui

Address M9-1 with the approved option A: make retained-frame evidence updates
part of inspection ownership, restoring valid picking/highlighting and ending
invalidated inspection exactly once without stale masks, labels or pick state.

- [x] Define evidence refresh and cancellation semantics in the viewer/frame
      protocols and viewer README, retaining schemas and inspector bytes.
- [x] Add failing regressions first on both adapters, then coordinate evidence
      adoption with the inspection owner. Cover ready-to-ready updates during
      picking and scoped explicit highlights, removed targets, pending activation,
      and updates with a pending sibling; verify pick restart and exact events.
- [x] Fence superseded evidence success/failure by revision, including reuse of
      an earlier usage object; add failing unit regressions before the fix.
- [x] Update the plan index and record verification evidence without changing
      earlier milestones' notes or findings.
- [x] Run focused tests and `cargo xtask check`; record counts, retries, skips,
      inspector size and unchanged Serve/export shell and comparison bytes.
- [x] After checks pass, run `git add -A`, commit with Conventional Commits
      (title at most 50 characters, body naming M9-1 and ending with the requested
      co-author trailer), and push the branch.
- [x] After that push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      against the complete local diff from `origin/main`; record numbered findings
      with severity, impact, lettered options and a recommendation without fixing.

### Milestone 10 verification notes

The baseline is `a43a643535f138d5741dccee0f576f92923ea7d8` on
`calummoore/tianjin-v6`. Refreshed `origin/main` remains
`7ca301c04ca898db6ff60b110beb213ec740b004`; no merge or rebase was performed.
Earlier milestone notes/findings remain byte-identical, and this milestone adds
no deletions of files, tests, docs or features. Existing tip-to-tip main-only
differences predate this work and were left untouched.

M9-1 now routes retained-frame usage adoption through the inspection owner.
The owner snapshots its referenced keys, fences obsolete work and restores valid
masks, outlines and catalogue labels with the original request's frame scope.
Unrelated evidence does not redraw or await that scope. Invalidated targets or
ready capability clear presentation and end active picking once with the new
host-only `evidence` reason. Pending activation is cancelled with `disposed`,
without start/end events; subsequent picking waits for refreshed, inspectable
usage. Per-session revisions fence superseded update success/failure even when a
later update reuses an earlier usage object. The wire/catalogue schemas and both
adapter implementations remain unchanged. Viewer/frame protocols, viewer/client
READMEs and the plan index describe the lifecycle; the live-evidence contract's
existing document-ownership rule remains applicable.

Added **18 Chromium regressions** across both adapters for active pick refresh,
scoped explicit highlights beside ready/pending siblings, unrelated sibling
updates, removed targets, pending/unavailable capability loss, exact events,
restart after valid evidence returns, and cancellation during both mask and label
activation. Tests assert mask outlines, labels, retained document/mount identity
and no unrelated geometry. Added **four Node regressions** for superseded update
success/failure with fresh or reused snapshot objects. All 18 browser cases and
the corresponding unit cases failed before their fixes. Typechecking identified
a missing `slots` field in the new fixture; it was corrected without removing or
relaxing tests. Earlier milestone tests are retained.

Focused validation passed **69 Node tests and 129 Chromium tests**, with no
failures, retries or skips. The final `cargo xtask check` passed on 16 September
2026: **1,669 Node tests, 416 Chromium tests and three Rust tests**, with zero
failures, retries, skips or ignored tests. No flaky-test rerun was needed. Node
took 410.4 seconds; Chromium took 10.9 minutes. Dependency auditing reported zero
vulnerabilities. Formatting, lint, builds/typechecks, example validation (278
files), package checks, all five packed-consumer scenarios, Rust formatting,
Clippy and the eight-file Rust length audit passed. The 15 changed files stayed
stable during the gate. Every changed/new TypeScript file is below 300 lines.
Changed Markdown, 50 current documentation links and `git diff --check` passed;
historical review links were left unchanged with their owning milestone notes.

The inspector is byte-identical at **8,733 / 9,216 bytes**, with SHA-256
`1952cf0499da61d8041a88c2dd18e9525eebd947c3985f3f53ec7a9c157bb7b0`.
Actual Serve HTML and screenshots match exactly on mobile/desktop, with zero
changed pixels; visual inspection confirms unchanged presentation. Export keeps
all **1,169 paths**: 986 byte-identical files, 182 differing only in generated
deployment/comparison identities, and the expected changed-path `review.json`.
All **180 shell HTML files** retain identical markup after replacing only those
identities. All **608 comparison snapshot/resource files**, **277 generated HTML
documents**, and every exported client asset are byte-identical. No inspector,
shell, stylesheet, example, snapshot or schema source changed.

Evidence is retained in `.context/viewer-m10/`: failing regression logs, focused
logs, `xtask-check.log`, before/after Serve captures and exports,
`byte-comparison-final.json`, and the check-input stability audit.

Implementation commit `76451b52d5674829ff9dc5d1955e688284df2cf3`,
`fix(viewer): coordinate evidence inspection`, includes both new test/fixture
files and was pushed before the following review.

### Milestone 10 post-push review

No new findings. M9-1 is addressed with the approved option A, including the
documented `evidence` reason and pending-activation cancellation semantics.

The required prompt reviewed the complete **647-file** local diff at `76451b5`
against `origin/main` (`7ca301c04ca898db6ff60b110beb213ec740b004`) after the push,
using `git diff origin/main...HEAD`. The inventory contains 313 modified,
226 added, 106 renamed and two deleted paths, with 25,899 insertions and 3,403
deletions. Worktree, index and untracked-file inventories were clean before and
after review. Coverage included source capture and instance identity, public
catalogue validation/privacy and projection, source/runtime lifetimes, inspection
ownership and both transports, comparison publication/retention, Serve/watch
lifecycle, export ownership, package isolation, release/archive pairing, tests
and protocol alignment. The two branch-diff deletions remain the earlier approved
CSS split; this milestone adds no deletion or main integration.

The complete patch, diff statistics and path inventory are retained in
`.context/viewer-m10/review-*`. No implementation or test files changed during
review. Residual validation limits are Chromium-only browser coverage, local
Node 24.14.1 instead of the entire CI platform matrix, and no live npm/OIDC
publication or GitHub protection changes. Recording this review and updating the
plan index are documentation-only follow-ups; the plan stays active until its
implementation PR merges.

## Milestone 11: Geometry activation ownership

Tags: ui

Make geometry refreshes join an in-flight inspection presentation so they cannot
race pending pick activation past evidence cancellation.

- [x] Clarify geometry coalescing in the viewer/frame protocols and viewer client
      README without changing the adapter wire contract.
- [x] Add a deterministic same-origin and postMessage regression first, then
      coordinate geometry label refreshes with the activating presentation.
- [x] Update the plan index and record focused/full verification evidence.
- [x] Run focused tests and `cargo xtask check`; require zero failures, retries
      and skips, and confirm formatting, docs and the complete browser suite.
- [ ] After checks pass, run `git add -A`, commit with Conventional Commits and
      push the branch.
- [ ] After that push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      against the complete local diff from `origin/main`; report numbered findings
      with severity, impact, lettered options and a recommendation without fixing.

### Milestone 11 verification notes

Minimum-Node CI failed only
`postMessage evidence cancels pending list activation without events`: a geometry
notification raced the activation's own label render and started a second
boundary read. The second read could settle `startPick` while the first remained
blocked, so the following evidence update observed an active pick and the caller
received `resolved` instead of `disposed`.

The regression fixture now raises that geometry notification during initial
highlighting and allows the competing work to advance before evidence changes.
Before the production fix, both same-origin and postMessage cases failed with the
CI's exact `resolved`/`disposed` mismatch. `FrameHighlights` now records the
current presentation promise; geometry label refreshes join it, and only a later
notification can begin another boundary read. The adapter wire contract and
inspector bundle are unchanged.

Focused verification passed under Node 22.14.0: both regression cases, three
complete repetitions of all 18 evidence cases (**54/54**), and all viewer browser
specs on the CI Chromium channel (**111/111**). The viewer package unit suite
passed **42/42**. Formatting, lint, build and typechecking passed.

The final `PLAYWRIGHT_CHANNEL=chromium cargo xtask check` passed on 16 September
2026: **1,754 Node tests, 418 Chromium tests and three Rust tests**, with zero
failures, retries, skips, ignored tests or todos. Dependency auditing reported
zero vulnerabilities. Example build/check (278 files), both-package checks and
all five packed-consumer smoke scenarios, Rust formatting, Clippy, workspace
tests and the eight-file Rust length audit passed. `git diff --check` passed and
the eight changed files remained the intended implementation, regression,
protocol, README and plan updates.

## Post-merge follow-up (non-blocking)

- Merge the combined release-please PR for viewer 0.1.0 and CLI 0.10.0, checking
  exact pairing, lockfile, both changelogs and required CI. Complete the
  [viewer first publication](../docs/protocol/npm-bootstrap.md#viewer-first-publication)
  from its immutable tagged commit and configure its separate trusted publisher
  while the `npm` job awaits approval; verify both tag streams' protections.
- Verify and report both published versions, tags/commit, exact CLI dependency,
  tarball hashes/inventories, `latest` tags and signatures/provenance evidence.
  Record the interactive viewer bootstrap's lack of OIDC provenance explicitly.
- Smoke-test both published packages from a clean consumer: CLI export/build,
  all viewer public imports and SSR, then mount the viewer with the postMessage
  adapter against a published export on a second origin using its CORS contract.
- Close this plan in `plans/README.md` when the implementation PR merges;
  publication and the published-package smoke remain non-blocking follow-up.
