# In-Frame Catalogue Link Navigation

**Status:** Completed.

**Goal:** Make an explicit catalogue link activated inside a Mokly fragment
navigate the outer Browse shell to the destination's canonical page, while
keeping that destination selected, expanded, and visible in the catalogue
tree.

**Protocol:** Implement the approved
[`docs/protocol/mokly-navigation.md`](../docs/protocol/mokly-navigation.md)
contract. The package and runtime protocols remain authoritative for portable
output, sandboxing, and progressive navigation.

**Architecture:** Preserve two representations of one logical link. Generated
HTML keeps its viewport- and color-scheme-compatible relative artifact `href`
for standalone and Review portability. Eligible native hyperlinks also carry a
reserved marker containing the stable entry id and optional fragment; a
`data-nav-href`-only reference stays inert metadata. Browse adapts only the
served/preview copy to authenticate markers and derive inert target metadata;
the portable live `href` and target remain unchanged. The parent client
recognizes marked links in same-origin, script-disabled frames, derives their
stable `/id/<id>` destination, invokes the existing latest-wins route transition
for current-context navigation, and exclusively handles validated new-context
requests. The iframe never receives top-navigation permission, so failed or
disabled enhancement stays frame-owned and cannot replace the shell. One client
helper owns the invariant that the active navigation row is selected, disclosed,
filter-visible, and scrolled into view.

**Tech stack:** TypeScript ESM, React 19 static rendering, parse5, Node 22 test
runner through `tsx`, Playwright Chromium, the synthetic basic consumer, and
Rust `xtask` repository gates.

## Mainline Preservation Record

The ninth-pass plan-maintenance audit ran on 2026-08-25 before implementation:

- source tip before the ninth review corrections:
  `54b231e538f01d2f510f26e4accd2b81643587f5`;
- fetched `origin/main` tip:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- merge base:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- `base..origin/main` additions audit: empty; and
- deletion audit against `origin/main`: empty.

The tenth-pass remediation audit ran later on 2026-08-25, still before
implementation:

- source tip before the final review corrections:
  `07adc8861f7ca4d79e4048c3ff287af7676b8e9e`;
- fetched `origin/main` tip:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- merge base:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- `base..origin/main` additions audit: empty; and
- deletion audit against `origin/main`: empty.

The implementation-start audit ran on 2026-08-25:

- unrevised source tip:
  `27394d7c9f8a4ee6e5a1735c839ac497751c2617`;
- fetched `origin/main` tip:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- merge base:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- `base..origin/main` additions audit: empty; and
- deletion audit against `origin/main`: empty.

The final pre-commit implementation audit ran on 2026-08-25:

- captured pre-integration source tip:
  `27394d7c9f8a4ee6e5a1735c839ac497751c2617`;
- fetched `origin/main` tip:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- merge base:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- `base..origin/main` additions audit: empty;
- full staged patch, name-status, and whitespace audits: inspected and clean; and
- deletion audit against `origin/main`: no deletions.

The review-follow-up audit ran on 2026-08-25 before its delivery commit:

- captured pre-integration source tip:
  `844e371b04d6fe97c717547c7d203f5b44de6f92`;
- fetched `origin/main` tip:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- merge base:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- `base..origin/main` additions audit: empty;
- full working patch and whitespace audits: inspected and clean; and
- deletion audit against `origin/main`: no deletions.

The generated-ownership follow-up audit ran on 2026-08-25 before its delivery
commit:

- captured pre-integration source tip:
  `3ebc88ba6953ec574f66f651feaff75e2683a9f2`;
- fetched `origin/main` tip:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- merge base:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- `base..origin/main` additions audit: empty;
- full working patch and whitespace audits: inspected and clean; and
- deletion audit against `origin/main`: no deletions.

The ownership-encoding and HTTP follow-up audit ran on 2026-08-25 before its
delivery commit:

- captured pre-integration source tip:
  `61bc09c3687e880878734191b6885c0b9fe7b41c`;
- fetched `origin/main` tip:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- merge base:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- `base..origin/main` additions audit: empty;
- full working patch, regenerated-header-only output diff, and whitespace
  audits: inspected and clean; and
- deletion audit against `origin/main`: no deletions.

The decoded-path separator follow-up audit ran on 2026-08-25 before its
delivery commit:

- captured pre-integration source tip:
  `fddfc092df81e02efc71a229d2a2230e739de618`;
- fetched `origin/main` tip:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- merge base:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- `base..origin/main` additions audit: empty;
- full working patch and whitespace audits: inspected and clean; and
- deletion audit against `origin/main`: no deletions.

The canonical-path and update-coherence follow-up audit ran on 2026-08-25
before its delivery commit:

- captured pre-integration source tip:
  `bfcd06010fc4a25b22f138ce76636f27f7747ab8`;
- fetched `origin/main` tip:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- merge base:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- `base..origin/main` additions audit: empty;
- full working patch and whitespace audits: inspected and clean; and
- deletion audit against `origin/main`: no deletions.

The static-cache and command-documentation follow-up audit ran on 2026-08-25
before its delivery commit:

- captured pre-integration source tip:
  `bbc073f822f642827769fb205cfca992e0fc5fe8`;
- fetched `origin/main` tip:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- merge base:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- `base..origin/main` additions audit: empty;
- full working patch and whitespace audits: inspected and clean; and
- deletion audit against `origin/main`: no deletions.

The final-review boundary-hardening audit ran on 2026-08-25 before its delivery
commit:

- captured pre-integration source tip:
  `e873f48477765586de716211a8a2a6c88d738170`;
- fetched `origin/main` tip:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- merge base:
  `9fa89d33a0453a943675348086f1d068df5154ca`;
- `base..origin/main` additions audit: empty;
- full working patch and whitespace audits: inspected and clean; and
- deletion audit against `origin/main`: no deletions.

The manual exact-pushed-tip closeout audit ran on 2026-08-25 after the tenth
and final automated review cycle:

- pushed branch tip and upstream tip:
  `94491ee3d634ab8950f942521218ab89b736f608`;
- exact `origin/main..HEAD` whitespace audit: clean;
- exact `origin/main..HEAD` deletion audit: no deletions;
- all three review-pass-10 findings: fixed with unit, server, build-boundary,
  compatibility-transform, and Chromium coverage; and
- automated review stopped at the required ten-cycle limit, with no eleventh
  cycle run.

Milestone 1 must append a fresh dated pre-implementation audit rather than
overwriting this evidence. Milestone 4 must append the final pre-commit audit,
including each explicitly approved removal and its cleanup or an explicit
`no deletions` result.

## Constraints And Design Decisions

- Promote only complete logical `mock:<id>[#fragment]` links. Never infer
  catalogue intent from a raw relative URL or visible label.
- Use the stable id route for Browse adaptation so renaming a catalogue route
  does not invalidate generated navigation intent.
- Carry a logical anchor through `/id` and `/view` as one percent-encoded
  `fragment` query value, then render it as an encoded hash on each target
  iframe source. Served Browse injects it server-side; static preview injects it
  progressively into current and light/dark swap sources. Link activation needs
  parent enhancement; no-JavaScript links keep portable in-frame behavior.
- Keep the committed fragment bytes portable and adapt responses/copies
  without mutating their files on disk.
- Authenticate markers only on current-manifest screen fragments and generated
  legacy documents with ownership headers matching their manifest `sourcePath`.
  Strip reserved-looking metadata from unowned served/preview HTML copies.
- Consumer scripts remain disabled. Browse adds same-origin inspection only;
  top navigation, scripts, forms, popups, and downloads stay forbidden for the
  generated frame and every nested browsing context. Review panes remain
  unchanged.
- Promote only an HTML `<a>`/`<area>` or SVG `<a>` whose `href` carried the
  logical destination. Reject logical `href` on every other element and require
  `data-nav-href` for metadata-only intent.
- Reject `<base href>` whenever a document contains an activatable logical
  link, both before and after compatibility transformation. Continue to support
  `<base target>` and permit a base URL in documents whose only logical
  references are metadata-only.
- Default and `_self` catalogue links navigate the outer shell. Downloads stay
  portable/native; the adapter retains explicit non-self requests only in
  trusted inert metadata without changing live targets. Parent code handles
  those requests and modified activation against the canonical destination with
  `noopener` where a new context is opened.
- If search or Changed filtering hides the new active row, clear only the
  hiding constraint. Preserve those controls when the row is already visible.
- The selected-screen, active-navigation, and narrow-drawer visuals already
  exist in the approved Design catalogue. This change introduces no new visual
  treatment, so no mockup update is required. If implementation discovers a
  need for a pinned current row, warning, badge, or other new visible state,
  stop and add a tagged mockup milestone before changing the UI.
- Keep growing files short. Add focused client/server modules rather than
  extending `src/client/browse.ts`, `src/client/browse_state.ts`, or
  `src/server/http.ts` beyond their current near-300-line size.
- Treat any post-transform change to a logical-reference record as a contract
  failure: marker expectation, element namespace/native-link class, logical
  attribute names, and portable values remain one invariant.
- Use one exact pure target parser in server adaptation and parent enhancement;
  do not broaden iframe capabilities or rewrite consumer-owned live targets.
- Do not change Review-pane link behavior or enable consumer application
  scripts as part of this work.

## Milestone 0: Protocol And Plan Baseline

Summary: establish a complete behavioral contract and an indexed implementation
plan before changing generated output or runtime behavior.

- [x] Add `docs/protocol/mokly-navigation.md` covering logical-link
      classification, portable output, Browse adaptation, safe degradation,
      sandbox limits, fragments, active-tree visibility, and verification.
- [x] Align the package, runtime, shell-design, build-pipeline, and package
      boundary docs with the new navigation ownership.
- [x] Confirm that existing selected-screen and navigation mockups already
      specify the required final pixels and record the no-new-visual-state
      decision.
- [x] Create this plan and list it in `plans/README.md` under Active.

At completion, the protocol is internally consistent and implementation can
proceed without inventing product behavior.

## Milestone 0A: Post-Review Contract Corrections

Summary: resolve every finding from the first post-push review without
reopening the completed protocol baseline milestone.

- [x] Replace top-level hash transport with a request-visible `fragment` query,
      define its grammar and cross-view anchor validation, and specify iframe
      hash rendering.
- [x] Keep `allow-popups` forbidden and assign modified/non-self activation
      exclusively to trusted parent enhancement.
- [x] Mark build, package, runtime, shell, and architecture passages as planned
      wherever the current implementation does not yet provide link markers or
      outer frame navigation.
- [x] Move Review compatibility coverage into the marker milestone and add a
      watched-serve lifecycle regression to the server milestone.

At completion, the approved contract and implementation plan incorporate all
five initial review recommendations.

## Milestone 0B: Security And Preview Corrections

Summary: incorporate every valid finding from the second review pass before
implementation begins.

- [x] Scope server-rendered fragment injection to served Browse and define the
      enhanced and JavaScript-disabled behavior of the static preview.
- [x] Require Browse-response sanitization of unmarked top targets and base
      targets before granting user-activated top-navigation permission.
- [x] Bind compatibility validation to complete marker-and-portable-attribute
      records rather than marker values alone.
- [x] Clarify target protocol status and use the optional-fragment grammar in
      the package and build-pipeline contracts.

At completion, the plan closes all four second-pass review findings without
adding dynamic preview infrastructure.

## Milestone 0C: Activation And Target Corrections

Summary: close the native-link and top-target gaps found by the third review
pass before implementation begins.

- [x] Limit Browse activation to native HTML `a`/`area` and SVG `a` elements
      whose logical destination came from `href`; keep `data-nav-href`-only
      records as portable metadata.
- [x] Neutralize every consumer-authored non-self and base target, including
      marked, download, and named targets, retaining eligible explicit requests
      only in adapter-produced inert metadata for trusted parent handling.
- [x] Add failure-first coverage for metadata-only records, marked top/parent
      targets, matching named contexts, target keyword casing, spoofed target
      metadata, and download targets to the implementation milestones.

At completion, no logical metadata becomes an invented interaction and no
consumer-authored target can bypass parent-owned navigation.

## Milestone 0D: Ownership, Swap, And Parser Corrections

Summary: close every generated-ownership, preview-state, and target-parser gap
found by the fourth review pass.

- [x] Gate marker promotion to current-manifest generated documents while
      requiring their ownership headers, sanitizing all public HTML, and
      removing reserved metadata from unowned copies.
- [x] Require static-preview fragments on current plus light/dark swap sources,
      scoped to the first use-case step and retained through scheme changes.
- [x] Define one strict local target grammar and extend sanitization to HTML,
      SVG, every `target`, and every `formtarget` attribute.

At completion, marker trust follows generated ownership, preview anchors are
durable, and the sandbox sanitizer has one testable parsing boundary.

## Milestone 0E: Transform, Metadata, And Lifecycle Corrections

Summary: close the post-transform, metadata-owner, watch-lifecycle, and preview
documentation gaps found by the fifth review pass.

- [x] Require final-document anchor indexing and cross-view fragment validation
      after all compatibility transforms.
- [x] Add marker-free HTML resource and SVG non-anchor `href` owners to the
      implementation coverage.
- [x] Split watched Serve coverage into content reload and manifest restart
      lifecycle regressions.
- [x] Add the preview deployment protocol to final documentation alignment.

At completion, later milestones must prove every final transformed anchor,
metadata-only owner, watch lifecycle, and preview documentation boundary.

## Milestone 0F: Capability And Resource-Href Corrections

Summary: close the nested-context escape and live-resource ambiguity found by
the sixth review pass. These decisions supersede the native top-navigation and
target-sanitizer outcomes in Milestones 0B–0D and the resource-`href` outcome in
Milestone 0E; those completed checklists remain as the review history.

- [x] Remove native outer-navigation fallback and keep both top-navigation
      sandbox restrictions active for direct and nested frame content.
- [x] Preserve live `href`, `target`, `formtarget`, and base targets in adapted
      copies; make trusted parent enhancement the only outer-navigation owner.
- [x] Reject logical `href` on every non-native-link owner and reserve
      `data-nav-href` for metadata-only references.
- [x] Add direct, `srcdoc`, local, and cross-origin nested escape cases plus
      resource-owner rejection to the implementation coverage.

At completion, the security boundary depends on a denied browser capability,
not complete recursive sanitization of consumer-controlled browsing contexts.

## Milestone 0G: API, Status, And Activation Corrections

Summary: close the current-behavior status, public fragment API, and
middle-click coverage gaps found by the seventh review pass.

- [x] Keep owner-based logical-`href` rejection explicitly planned in the
      package and build-pipeline docs while documenting today's attribute-based
      rewrite.
- [x] Define fragments as a separate optional `mockLink` argument and
      `MockLink` prop, with raw complete logical values retained for authored
      HTML and compatibility metadata.
- [x] Require both modifier-key click and middle-button `auxclick` coverage for
      trusted new-context activation.

At completion, current and target behavior are distinct, the public helper API
does not overload entry ids with fragment syntax, and every common browser
new-context gesture is named by the implementation plan.

## Milestone 0H: Nested-Source And Status Corrections

Summary: close the nested activation-source and protocol-status gaps found by
the eighth review pass.

- [x] Require marked and unmarked links in `srcdoc`, same-origin local,
      generated-fragment, and cross-origin nested frames to remain ignored by
      outer navigation as well as sandboxed from native shell navigation.
- [x] Add document-level delivery status to the package and shell-design
      protocols that contain planned navigation behavior.

At completion, parent enhancement is limited to each shell-owned frame's
immediate document, and the protocol index's delivery-status rule holds for
every protocol touched by this plan.

## Milestone 0I: Base URL, Surface, Preview, And Audit Corrections

Summary: close the base-URL authentication, supported-link coverage,
static-preview ownership, and durable-audit gaps found by the ninth review
pass.

- [x] Reject `<base href>` before and after compatibility transformation when a
      document contains an activatable logical link, and fail closed if a
      trusted adapted document violates the same invariant.
- [x] Require positive client and browser coverage for `MockLink`, raw HTML
      anchors and areas, SVG anchors, and generated legacy embeds.
- [x] Separate static-preview fragment-query enhancement into its own tagged UI
      milestone instead of claiming it complete with served query transport.
- [x] Commit immutable mainline-audit evidence in this plan and require future
      implementation/final audits to append their results here.

At completion, portable-link authentication accounts for the effective base
URL, all supported link owners have positive coverage, milestone completion is
honest, and preservation evidence survives outside ignored scratch files.

## Milestone 0J: Helper, Preview, And Review Corrections

Summary: close the helper-boundary, absent-anchor, and late Review-regression
gaps found by the tenth and final review pass.

- [x] Require one shared catalogue-id grammar at helper, builder, registry, and
      manifest boundaries, with explicit rejection of overloaded fragment or
      logical-scheme syntax passed through the helper id/`to` input.
- [x] Add pure-client and browser coverage for a syntactically valid static-
      preview fragment that names no anchor.
- [x] Repeat unit, server, and browser Review safety coverage after the frame-
      navigation client is introduced, at the milestone where that regression
      risk first exists.

At completion, helper inputs cannot bypass the separate fragment API, every
specified static-preview outcome has a direct regression, and later client work
cannot silently promote links inside Review panes.

## Milestone 1: Portable Logical-Link Identity

Summary: generated documents retain stable catalogue intent alongside their
existing portable artifact links; Browse behavior is not activated yet.

- [x] Before implementation, fetch `origin/main`, capture the unrevised source
      tip, fetched main tip, and merge base, audit `base..origin/main`
      additions, and append the dated immutable values and result to the
      Mainline Preservation Record above.
- [x] Add failure-first public API cases to `tests/package.test.ts`, the
      NodeNext fixture, and the packed ESM smoke fixture for
      `mockLink(id, fragment?)` and `<MockLink to={id} fragment={fragment}>`.
      Prove the helpers emit `mock:<id>[#fragment]`, keep id and bare fragment
      separate, do not percent-encode or accept a leading `#`, and preserve the
      existing id-only calls. Explicitly reject non-kebab-case ids and
      overloaded inputs such as `id#fragment`, `id%23fragment`, and `mock:id`
      through both the function argument and component `to` prop.
- [x] Add failure-first cases to `tests/build_links.test.ts` for a reserved
      `data-mokly-link` marker on `MockLink` and raw `mock:` hrefs in HTML
      anchors/areas and SVG anchors; prove a `data-nav-href`-only span remains
      marker-free; reject logical `href` values on an arbitrary HTML element,
      HTML `link`, and SVG `use`/`image`; prove `data-nav-href` on those owners
      remains marker-free; reject `<base href>` in generated and legacy
      documents with an activatable logical link while allowing `<base target>`
      and metadata-only logical references; and cover both attribute orders on
      one eligible link.
- [x] Cover screen and use-case ids, optional target fragments, mobile and
      desktop output, dark-to-dark resolution, dark-to-light fallback, exact
      fragment grammar, and the requirement that a target anchor exists in
      every generated destination view Browse can show.
- [x] Add failure-first cases for a consumer-authored reserved marker,
      different logical destinations on one element, unknown ids, collection
      ids, malformed fragments, and compatibility transformers that add/remove
      a marker, change element namespace/native-link class, or change/remove
      only its portable `href`/`data-nav-href`. Include transformers that add
      `<base href>` to an activatable document and remove the requested anchor
      only from a non-current destination view.
- [x] Extend `src/build/mock_links.ts` with typed logical-target parsing and
      deterministic marker insertion for eligible HTML `a`/`area` and SVG `a`
      hrefs while preserving the byte-targeted rewrite and portable relative
      URL for every supported navigation attribute. Reject a logical `href` on
      any other element before it can be rewritten as a resource URL, and
      reject an activatable logical link in a document with `<base href>`.
- [x] Extract or reuse one pure catalogue-id grammar validator across the
      authoring helpers, builder parser, registry validation, and manifest
      validation rather than duplicating the regular expression. Extend
      `src/authoring/links.tsx` with an optional bare `fragment` argument on
      `mockLink` and prop on `MockLink`; validate the id and shared logical
      fragment grammar before composing `mock:<id>#<fragment>`, and never pass
      the package-only prop through to the rendered anchor.
- [x] Validate one logical destination per element and reserve the marker from
      consumer output. Keep raw relative, external, asset, and same-document
      links marker-free.
- [x] Preserve and validate a multiset of complete logical-reference records
      across `transformCompatibilityDocuments`: expected marker presence and
      value, namespace/native-link class, logical attribute names, and their
      exact resolved portable values. Fail through the existing typed
      `MoklyError` contract on divergence.
- [x] After all compatibility transforms, index anchors from the final output
      documents and repeat cross-view anchor validation for every logical
      reference, including sibling viewports and applicable dark output.
- [x] Ensure HTML/resource validation ignores the inert marker as a URL while
      continuing to validate the rewritten `href` and `data-nav-href`.
- [x] Add Review artifact and served Review regressions proving marker-bearing
      portable pane documents remain byte-unmodified, retain relative links,
      receive no Browse adaptation, and stay inside the existing strict
      sandbox.
- [x] Run the focused link and compatibility tests with
      `npm run build && npx tsx --test tests/build_links.test.ts tests/compatibility.test.ts`.
- [x] Run the focused Review regressions in `tests/review_safety.test.ts` and
      `tests/server_review.test.ts` before marking marker output complete.
- [x] Regenerate and check
      `examples/basic/generated/**` with `npm run example:build` and
      `npm run example:check`.

At completion, every explicit catalogue link has portable fallback bytes and
stable, validated identity, while all existing Browse and Review pages remain
functional.

## Milestone 2: Safe Browse Authentication And Served Query Transport

Summary: served and preview copies authenticate generated link intent without
granting consumer frames native outer-navigation capability, while served
Browse carries logical fragments through request-visible queries.

- [x] Add failure-first adapter/server tests for preserved portable hrefs and
      live targets, derived explicit/inherited-base target metadata and explicit
      override precedence, download exclusion, malformed trusted markers,
      metadata-only references, manifest-owned fragments/legacy pages, and
      unowned HTML with reserved-looking metadata; fail closed when a trusted
      route loses or swaps its generated source header, or its marker and
      expected portable href diverge. Also fail closed when a trusted document
      with an activatable marker contains `<base href>`, including a
      post-build-tampering fixture.
- [x] Add security cases for unmarked external, raw relative, same-document,
      `_top`, `_parent`, HTML/SVG anchors and areas, `<base target>`, forms and
      `formtarget`, plus marked targets, mixed-case keywords, matching names,
      whitespace/control and invalid values, spoofed `data-mokly-target`, and
      `download target="_top"`; prove adaptation preserves consumer-owned live
      attributes while the frame cannot target the shell or open a popup.
- [x] Add browser security regressions for `_top`/`_parent` activation from the
      immediate document and from `srcdoc`, same-origin local, and cross-origin
      nested frames. Assert none replace the shell and no nested context gains a
      popup, script, form, download, or top-navigation capability. In `srcdoc`,
      same-origin local, generated-fragment, and cross-origin nested frames,
      activate both marked-looking and unmarked links and prove neither triggers
      parent-owned outer navigation.
- [x] Add table-driven unit tests for the shared typed target parser: absent,
      empty, keyword casing, safe named grammar, case preservation, whitespace,
      controls, leading underscore, and punctuation outside the allowlist.
- [x] Create one typed Browse-document adapter that validates markers against
      `Catalogue` and a manifest route-to-source map, strips reserved metadata
      from unowned HTML, verifies the matching ownership header and a trusted
      marker's exact view-relative portable href, resolves own-target precedence
      over the applicable first base target, derives trusted target metadata,
      preserves all live navigation attributes, and never mutates disk.
- [x] Extract `/static/` serving from the over-target `src/server/http.ts` and
      adapt every HTML response below `/static/` while preserving HEAD, content
      type, confinement, ownership, and non-HTML bytes.
- [x] Enable same-origin inspection on Browse frames without adding
      `allow-top-navigation`, `allow-top-navigation-by-user-activation`, scripts,
      forms, popups, or downloads. Keep every Review permission unchanged.
- [x] In served Browse, carry exactly one encoded `fragment` query through
      `/id` and `/view`; decode once, validate grammar and cross-view anchors,
      return HTTP 400 on failure, and render encoded iframe hashes through
      scheme swaps or the first use-case step.
- [x] Reuse the adapter while building `.context/mokly-preview`, preserving
      extensionless Cloudflare routes and queries, stripping untrusted reserved
      metadata, and failing the build for invalid trusted markers without
      claiming static request-time validation or injection.
- [x] Test server-rendered fragment injection with JavaScript disabled. In both
      served Browse and preview, prove disabled or failed enhancement keeps link
      activation inside the sandbox and cannot replace the shell or open a
      popup.
- [x] Add a watched-serve regression that changes only a `MockLink`
      destination, waits for rebuild and reload without a child restart, and
      verifies the newly adapted HTML is served.
- [x] Add a separate watched-serve regression that changes a route/manifest,
      waits for the child restart on the same resolved port, verifies the
      latest manifest and adapted HTML, and proves shutdown leaves no orphan
      child.
- [x] Run focused server/preview tests, `npm run preview:build`, and watched and
      no-watch Serve smoke tests without orphan processes.

At completion, adapter trust and served fragment transport are functional,
degraded links remain safely frame-owned, and the UI milestones can inspect
trusted frames. Static-preview query application remains owned by Milestone 2A.

## Milestone 2A: Static Preview Fragment Enhancement

Tags: ui

Summary: the deployed static preview progressively applies one validated
logical-fragment query to every applicable current and light/dark frame source,
without adding a request handler.

- [x] Add failure-first pure client tests for absent, single, and duplicate
      `fragment` query values; decode-once and grammar validation; encoded
      current/light/dark source updates; first-use-case-step scope; and invalid
      or selector-shaped values failing closed without DOM mutation. Include a
      syntactically valid but absent anchor and prove the client still applies
      its encoded hash without querying or interpreting the fragment as a DOM
      selector.
- [x] Implement the static-preview query applier in a focused parent-client
      helper/module. Update `src`, `data-fragment-light`, and
      `data-fragment-dark` wherever present, and add no backend or static
      request-time rendering path.
- [x] Add direct-URL Playwright coverage for a valid fragment on a screen and
      use-case preview page, light/dark toggling, every current and swap source,
      first-step-only scoping, invalid and duplicate query no-ops, and the
      JavaScript-disabled static fallback remaining at the top of the frame. A
      valid-but-absent anchor must retain its hash while the frame remains
      scrolled to the top in both light and dark sources.
- [x] Run the focused client/preview tests, `npm run preview:build`, and a
      query-preserving `wrangler pages dev` smoke test without orphan processes.

At completion, direct static-preview URLs apply and retain validated logical
fragments progressively, while JavaScript-disabled preview remains a safe
portable fallback.

## Milestone 3: Outer Navigation And Active-Tree UI

Tags: ui

Summary: ordinary activation inside a fragment uses the existing progressive
outer route transition, and every outer route change reveals its catalogue row.
No backend response transformation is included in this milestone.

- [x] Add failure-first client tests in new focused test files for frame-link
      candidate classification across `MockLink`, raw HTML anchor and area,
      SVG anchor, and generated legacy output; event-source validation; primary
      and keyboard activation; Meta/Ctrl/Shift-modified click; middle-button
      `auxclick` (`button === 1`); explicit target handling; latest-wins
      delegation; inaccessible/cross-origin frame fallback; and unchanged
      unmarked, download, external, hash, and metadata-only behavior.
- [x] Extract navigation candidate/sequencing code from
      `src/client/browse.ts` into a focused module before adding frame behavior;
      keep imports and public internal test seams typed.
- [x] Add a frame-navigation module that attaches on initial load, scheme
      swaps, flow frames, legacy embeds, and progressively installed views. It
      must read only validated `data-mokly-link` markers and delegate to the
      outer route navigator through `/id/<id>`. Attach only to the immediate
      document of each shell-owned frame; never traverse or bind descendant
      iframe documents.
- [x] For a validated modified activation or explicit non-self target, have
      package-owned parent code read only adapter-produced target metadata,
      route `_top`/`_parent` through the outer transition, and open new or named
      contexts with `noopener`; never delegate popup creation to frame content.
- [x] Extract catalogue-tree client state from the near-limit
      `browse_state.ts` into a focused navigation module. Replace
      `markActiveRow` with one `selectAndRevealRoute` operation used by primary
      navigation, Back, Forward, and initial enhancement.
- [x] Make `selectAndRevealRoute` mark exactly one row, open only its ancestor
      collections, clear only a hiding query/filter, reapply visibility, and
      call `scrollIntoView({ block: "nearest" })`. Close the responsive drawer
      after selection without collapsing the destination path.
- [x] Preserve viewport, color scheme, details disclosure, history scroll,
      focus/status behavior, and frame-collapse behavior across the new route
      transition.
- [x] Add Playwright regressions in a new
      `tests/browser/browse_navigation.spec.ts` that positively activate
      `MockLink`, a raw HTML anchor, raw HTML area, SVG anchor, and generated
      legacy-page link across the mobile frame, desktop frame, and use-case
      step. Assert the outer URL, heading, breadcrumbs, active row, disclosed
      ancestors, Back/Forward, and preserved shell state.
- [x] In the same spec, prove modified and explicit non-self activation opens
      the canonical Mokly page through parent enhancement. Cover Meta/Ctrl/
      Shift-click, middle-button `auxclick`, `_blank`, and a named target, while
      the iframe sandbox still lacks popup, script, and top-navigation
      permissions.
- [x] In the same spec, activate syntactically valid marked and ordinary links
      inside `srcdoc`, same-origin local, generated-fragment, and cross-origin
      nested frames. Assert the outer URL, active row, and shell view do not
      change and no new context opens.
- [x] After the frame-navigation client lands, rerun
      `tests/review_safety.test.ts` and `tests/server_review.test.ts`, then extend
      `tests/browser/review.spec.ts` with static and served Review cases that
      activate a marker-bearing portable pane link. Prove the pane retains its
      existing sandboxed behavior while the outer Review URL, mode, navigation,
      and open-context count stay unchanged and no Browse-derived target
      metadata appears.
- [x] Add static-preview integration coverage that follows a fragment link into
      the Milestone 2A query applier, toggles light and dark, and proves the
      current source and every swap source retain the encoded hash; cover
      first-step-only use-case behavior.
- [x] Cover an active destination initially hidden by search and Changed,
      plus a destination already visible so unrelated user state is retained.
- [x] Run the focused client tests and navigation Playwright spec after
      `npm run build`; run the existing `tests/browser/browse.spec.ts` and the
      focused cases in `tests/browser/review.spec.ts` to catch regressions in
      the persistent Browse and Review shells.

At completion, JavaScript-enabled Browse navigation, including trusted
new-context activation, is coherent and the active catalogue entry is always
visible. Safe failed/disabled-enhancement degradation remains as established by
Milestone 2.

## Milestone 4: Documentation, Verification, And Handoff

Summary: align public guidance with the shipped behavior, prove every affected
boundary, and deliver one reviewed pushed commit without automatically changing
post-push review findings.

- [x] Update `README.md` and `examples/basic/README.md` so `MockLink` documents
      its id-only and separate bare-`fragment` forms, `mockLink(id, fragment?)`,
      raw logical values for authored HTML/metadata, portable generated
      behavior, and canonical Browse navigation. Update
      `docs/protocol/npm-release.md`, the navigation protocol, and nearby
      architecture docs for the final preview adapter and any behavior clarified
      during implementation; remove contradictions rather than appending
      exceptions. Mark the navigation contract implemented and remove its
      temporary delivery-status gap only after the behavior passes.
- [x] Review `examples/basic/notes.md` and the Design catalogue against the
      final implementation. If pixels changed despite the constraint above,
      stop, add a new `Tags: mockup` milestone before a new `Tags: ui`
      milestone, and complete them in that order.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`, focused
      tests, `npm test`, `npm run example:check`, `npm run package:check`,
      `npm run package:smoke`, `npm run test:browser`, and the relevant manual
      server/preview smoke paths.
- [x] Run the authoritative `cargo xtask check` and continue fixing compile,
      lint, test, generated-output, packaging, or browser failures until the
      complete gate passes.
- [x] Fetch `origin/main` and perform the required mainline-preservation audit
      from the captured pre-integration source tip. Inspect
      `git diff --name-status origin/main`, the deletion-only diff, the full
      patch, and `git diff --check`; stop for approval before any unplanned
      mainline removal. Append the dated source/main tips, merge base,
      `base..origin/main` additions result, and either `no deletions` or every
      explicitly user-approved removal plus its cleanup to the Mainline
      Preservation Record above.
- [x] Update this plan's TODOs and move its link from Active to Completed in
      `plans/README.md` only after every implementation and verification item
      is complete.
- [x] Run `git add -A`, verify every new file is tracked, commit the complete
      work with a Conventional Commit title of at most 50 characters, inspect
      `git diff --name-status origin/main..HEAD` and the deletion-only diff,
      then push the current branch without renaming it.
- [x] Only after the push, run `cargo xtask review`. Do not automatically fix
      findings. Report every finding as a numbered item with severity,
      codebase/feature context, impact of doing nothing, lettered solution
      options, and a recommended option that considers whether a broader test,
      rule, lint, abstraction, or architectural change would prevent the class
      of issue from recurring.

At completion, all tests and `cargo xtask check` pass, the branch is committed
and pushed, the post-push review has inspected the complete diff against
`origin/main`, and the user has the findings needed to choose any follow-up.

## Milestone 5: Review Follow-Up Correctness

Summary: close the accepted post-push findings at shared validation and watched
runtime boundaries, then repeat the complete delivery and independent-review
loop.

- [x] Add failure-first regressions proving public link helpers reject
      non-string JavaScript values and lightweight watched updates refresh the
      Browse Changed filter without restarting the child.
- [x] Make the shared catalogue-id and fragment predicates safe for unknown
      runtime values so every current and future caller fails closed.
- [x] Carry freshly computed changed-route state through a typed parent/child
      update message and update the running server's shell context before
      publishing the reload event. Cover both available route lists and the
      unavailable state.
- [x] Update nearby runtime documentation for the refreshed Changed-filter
      lifecycle and record the review decisions in the review ledger.
- [x] Run focused tests and the authoritative `cargo xtask check`, continuing
      until the complete gate passes.
- [x] Fetch `origin/main`, repeat the required preservation and deletion audit,
      commit all review fixes with a Conventional Commit title of at most 50
      characters, and push the current branch without renaming it.
- [x] Run `cargo xtask review` after the push and repeat the investigate, fix,
      check, commit, push, and review loop for every valid finding, stopping
      after at most ten total review cycles.
- [x] Mark this milestone and plan completed and return its index link to
      Completed only after the final review has no valid findings.

## Milestone 6: Generated Ownership Integrity

Summary: close the final review's build-versus-serve ownership mismatch with
one shared header contract, then repeat the complete delivery and independent
review loop.

- [x] Add failure-first regressions proving compatibility transforms cannot
      remove or change screen-fragment or legacy ownership headers, while
      trusted Browse documents remain valid when their generated header uses
      CRLF.
- [x] Centralize generated-header creation and parsing, validate every final
      transformed HTML output against its expected source owner before write,
      and reuse that parser in build cleanup and Browse authentication.
- [x] Align the navigation, runtime, package, and build-pipeline documentation
      with post-transform ownership enforcement and newline-portable parsing.
- [x] Record the review findings and decisions in the review ledger, run
      focused tests, and run the authoritative `cargo xtask check`, continuing
      until the complete gate passes.
- [x] Fetch `origin/main`, repeat the required preservation and deletion audit,
      commit all review fixes with a Conventional Commit title of at most 50
      characters, and push the current branch without renaming it.
- [x] Run `cargo xtask review` after the push and repeat the investigate, fix,
      check, commit, push, and review loop for every valid finding, stopping
      after at most ten total review cycles.
- [x] Mark this milestone and plan completed and return its index link to
      Completed only after the final review has no valid findings.

## Milestone 7: Ownership Encoding And HEAD Safety

Summary: close the exact-tip review's generated-comment and HTTP method gaps
with shared preventive boundaries, then repeat the complete delivery and
independent-review loop.

- [x] Add failure-first regressions proving generated ownership round-trips
      source paths containing `-->`, `--`, `<`, and `>` without producing
      comment-unsafe bytes, while retaining LF/CRLF parsing and safe legacy
      migration support.
- [x] Replace raw source interpolation with a versioned, comment-safe ownership
      encoding and strictly decode it through the shared parser used by build,
      cleanup, Browse, and preview.
- [x] Add raw HTTP regressions proving `HEAD /id/missing` and invalid-fragment
      errors return 404/400 respectively with empty bodies on a reused
      keep-alive connection.
- [x] Make the request method mandatory at the shared text-response boundary
      and update every call site so future response branches cannot silently
      fall back to GET semantics.
- [x] Align nearby ownership and HTTP documentation, record review pass 6 in
      the review ledger, run focused tests, and run the authoritative
      `cargo xtask check`, continuing until the complete gate passes.
- [x] Fetch `origin/main`, repeat the required preservation and deletion audit,
      commit all review fixes with a Conventional Commit title of at most 50
      characters, and push the current branch without renaming it.
- [x] Run `cargo xtask review` after the push and repeat the investigate, fix,
      check, commit, push, and review loop for every valid finding, stopping
      after at most ten total review cycles.
- [x] Close this milestone after its review findings are remediated and the
      capped review loop's exact pushed tip has no unaddressed valid findings.

## Milestone 8: Decoded Path Separator Safety

Summary: close the shared served-path parsing gap from review pass 7 so every
current and future filesystem-backed route rejects Windows-style separators at
the common boundary, then repeat the complete delivery and independent-review
loop.

- [x] Add a failure-first shared-boundary regression proving percent-decoded
      backslashes, including traversal-shaped and UNC-shaped inputs, are
      rejected while valid percent-decoded filename bytes remain accepted.
- [x] Reject every decoded backslash in the shared relative URL-path parser so
      static, Review, and view callers cannot depend on downstream filesystem
      containment for platform-specific separator safety.
- [x] Align the README and runtime protocol with the strengthened served-path
      contract and record review pass 7 in the review ledger.
- [x] Run focused tests and the authoritative `cargo xtask check`, continuing
      until the complete gate passes.
- [x] Fetch `origin/main`, repeat the required preservation and deletion audit,
      commit all review fixes with a Conventional Commit title of at most 50
      characters, and push the current branch without renaming it.
- [x] Run `cargo xtask review` after the push and repeat the investigate, fix,
      check, commit, push, and review loop for every valid finding, stopping
      after at most ten total review cycles.
- [x] Close this milestone after its review findings are remediated and the
      capped review loop's exact pushed tip has no unaddressed valid findings.

## Milestone 9: Canonical Paths And Update Coherence

Summary: close review pass 8's remaining path-canonicalization and live-update
race at shared boundaries, including served Review documents, then repeat the
complete delivery and independent-review loop.

- [x] Add failure-first regressions proving encoded forward-slash aliases are
      rejected, a first SSE `ready` version newer than the rendered page causes
      an immediate recovery reload, and served Browse and Review shell HTML
      carries its request-snapshot update version.
- [x] Add a deterministic watched-browser regression that delays the initial
      event-stream connection across a successful rebuild and proves the stale
      page reloads to the new output while restoring Browse state.
- [x] Decode each original path segment independently and reject any decoded
      forward or backslash separator before reconstructing the relative path.
- [x] Stamp every served Browse shell and served Review shell document with the
      update version captured for that request, initialize the live-update
      controller from that stamp, and retain first-ready baseline behavior only
      for intentionally unstamped documents.
- [x] Align the README and runtime protocol with canonical decoded-separator
      rejection and request-version/SSE coherence, and record review pass 8 in
      the review ledger.
- [x] Run focused tests and the authoritative `cargo xtask check`, continuing
      until the complete gate passes.
- [x] Fetch `origin/main`, repeat the required preservation and deletion audit,
      commit all review fixes with a Conventional Commit title of at most 50
      characters, and push the current branch without renaming it.
- [x] Run `cargo xtask review` after the push and repeat the investigate, fix,
      check, commit, push, and review loop for every valid finding, stopping
      after at most ten total review cycles.
- [x] Close this milestone after its review findings are remediated and the
      capped review loop's exact pushed tip has no unaddressed valid findings.

## Milestone 10: Fresh Static Reload Delivery

Summary: close review pass 9's cache-coherence and command-documentation gaps
so reload-only watched updates cannot reuse a stale fragment at the same URL,
then complete the final delivery and independent-review loop.

- [x] Add a failure-first server regression proving successful `/static/`
      responses are explicitly non-cacheable, including HEAD semantics.
- [x] Send `Cache-Control: no-store` from the shared static-file response path
      so generated HTML and its mutable local resources cannot survive a
      watched reload in a browser or intermediary cache.
- [x] Correct the README command table and align the runtime protocol with the
      non-cacheable watched-static delivery contract; record review pass 9 in
      the review ledger.
- [x] Run focused tests and the authoritative `cargo xtask check`, continuing
      until the complete gate passes.
- [x] Fetch `origin/main`, repeat the required preservation and deletion audit,
      commit all review fixes with a Conventional Commit title of at most 50
      characters, and push the current branch without renaming it.
- [x] Run the tenth and final allowed `cargo xtask review` after the push,
      independently investigate its findings, and fix every valid finding that
      can be completed within the review-cycle limit.
- [x] Close this milestone after all final-review findings are remediated and
      the exact pushed tip is manually audited at the ten-cycle limit.

## Milestone 11: Final Review Boundary Hardening

Summary: remediate the three valid findings from the tenth and final allowed
review pass, then close the plan with a manual exact-tip audit because the
ten-cycle automated-review limit has been reached.

- [x] Add failure-first unit, server, compatibility-transform, and Chromium
      regressions for byte-exact served Review panes, duplicate reserved
      attributes, and automatic recovery from a Review generation failure.
- [x] Stamp only top-level Review shell documents while serving snapshot panes
      and their resources as the exact archived bytes.
- [x] Parse reserved metadata occurrences from raw start-tag bytes, reject
      duplicates in generated and compatibility-transformed documents, and
      remove every occurrence from unowned adapted HTML.
- [x] Load the live-update client from retryable Review failure documents so a
      later successful watched update recovers the open tab automatically.
- [x] Align the navigation/runtime protocols and README with these boundaries,
      and record review pass 10 plus each remediation in the review ledger.
- [x] Run focused tests and the authoritative `cargo xtask check`, continuing
      until the complete gate passes.
- [x] Fetch `origin/main`, repeat the required preservation and deletion audit,
      commit all final-review fixes with a Conventional Commit title of at most
      50 characters, and push the current branch without renaming it.
- [x] Manually inspect the exact pushed diff, mark every remaining milestone
      and the plan complete, and move its index link to Completed. Do not run an
      eleventh automated review cycle.

At completion, generated ownership proofs are valid HTML comments for every
supported source path, all ordinary HTTP response helpers require explicit
method semantics, every served relative path rejects decoded separators, every
live-update client can compare its rendered page snapshot with the event-stream
version, watched static resources cannot be reused stale, served Review panes
remain byte-exact, reserved metadata cannot survive through duplicates, and
retryable Review failures recover on the next watched update.
