# Rust Rebuild

Status: Active. Created 2026-10-12 with the user's consent. It supersedes the
native engine plan, which the documentation reset of 2026-10-14 deleted with
every other plan; the branch history before commit `d4bac78d` keeps it.
On 2026-10-12 the user decided to freeze the TypeScript backend immediately,
to remove the replaced JavaScript and its tests together instead of
incrementally, to treat the old outputs as guidance rather than an exact
parity target, to keep counting format versions instead of resetting to v1, to
provide no backward compatibility with old output, to reset Mokly Cloud, and to
keep the upload exchange protocol unchanged. The user also decided that
everything needed for the new version lands in this one plan and one pull
request, and overrode, for this pull request only, the plan rules that bind
one plan to one pull request and that require a functioning product after
every milestone: the branch has no CLI between Milestone 2 and Milestone 6.
Milestone 1 is complete: the Rust core architecture, the sidecar, HTML
screens, HTML components, and comparison contracts exist, the format
inventory names review v8, read model v7 and snapshot v4, and
every protocol page is classified. The structural test that binds the
catalogue page's format table to the old code was deleted on 2026-10-14 with
the other protocol-content tests. On 2026-10-12 the branch was rebased onto the
`AGENTS.md` that names the shared skills, and the rebuild procedures moved
from the removed `docs/dev` directory to
[the protocol page](../docs/protocol/rust-rebuild-procedures.md). Later that day
the user withdrew the committed generated tree: both comparison sides render
from sources, the static output is a plain output, and the Milestone 1 contracts were
revised to match (Decisions 11 to 13). The protocol index then moved eight
generated-tree and baseline pages to retired and the CSS attribution and
Markdown documents pages to rewritten; it lists 72 kept, 75 rewritten, and 21
retired pages beside the five new contracts. On 2026-10-13 the user chose the
two verbs `serve` and `build`, caches outside the repository, the enclosing
scope state in render requests, the sidecar's `describe` call, and frozen
wording for the last retired-page targets (Decisions 14 to 16), then the
definition handle and component entries for Storybook stories (Decisions 17
and 18), and one variant model for every kind (Decision 19), which added the
entry props contract as the sixth new page. Later that day the user adopted a
strict profile of JSON Schema 2020-12 for every prop schema (Decision 20), and
the component prop schema page moved from kept to rewritten. Later on
2026-10-13 the user chose a client-rendered shell with the catalogue index and
entry detail split (Decision 21), which added the shell delivery contract as
the seventh new page, retired the viewer SSR, shell bootstrap, and hydration
coverage pages, and moved the catalogue fetch, embeddable viewer, static export
delivery, and viewer appearance pages from kept to rewritten; the index lists
66 kept, 78 rewritten, and 24 retired pages. On 2026-10-13 the user then
settled the prop schema details, made `argTypes` control hints, unified the
screen and component template language, required one definition per export,
and added `renderPage` (Decisions 22 to 26); the five frozen pages that stated
the old variant rules carry pointers. On 2026-10-14 the user simplified the
shell's update model to one revision, document keys, and a per-process Serve
deployment id (Decision 27), which settled findings 1 to 6 of the shell
delivery review.
Later on 2026-10-14 the user reset the documentation (Decisions 28 and 29):
protocol pages define the end state only, the 24 pages that described the
previous backend alone are deleted, every status section and history pointer
is gone, the 78 pages that described it in part are rewritten now, no test
asserts protocol content, and every other plan is deleted. The previous protocol is `main` commit `0bbd737e`. The same day
the 78 pages were rewritten by subject, the kept pages were swept for retired
wording, the `dependencies` entry field went under Decision 5, and the index
lists 151 pages by subject. Later on 2026-10-14 the user settled the eleven
open shell delivery findings: document keys in the index, the live descriptor
for every catalogue, the deployment id in each event message, and no usage
route (Decision 30).
On 2026-10-14 the user settled the remaining review items of the end-state
rewrite as Decisions 31 to 38.

**Goal:** rebuild Mokly's backend as a Rust core with a Node sidecar for
JavaScript rendering, on a clean tree. The core meets five requirements:
detect changes and affected screens from rendered output and CSS rules, as
today; render screens and components from HTML with YAML front matter without
JavaScript; render every view in memory from the sources of either commit,
with no generated tree;
render components, screens, and stories from JavaScript, React, and Storybook;
and work well with catalogues of thousands of screens. The viewer package stays
and reads the new formats.

**Problem:** in under three months the backend reached 53,000 lines of
TypeScript, 173,000 lines of tests, 169 protocol documents, and 62 plans. Most
of that weight comes from doing the work in JavaScript: string materials, text
offsets, memory tricks, worker and IPC layers, an FFI bridge, and the residue
of six manifest versions and two output modes. Measured on the large fixture
on 2026-10-05, React rendering took 54 to 67 percent of every compile, and the
comparison phase ran out of memory in both Serve and Export. The raw spans and
phase table are under `.context/native-rust-engine/measurements-2026-10-05.md`.
Carrying that code into a Rust engine and a new HTML rendering model costs
more than re-deriving the behaviour from the requirements.

**Decisions (user, 2026-10-12):**

1. Freeze the TypeScript backend now. No new product behaviour lands in `src/`
   or its contracts. Bug fixes Mokly Cloud needs before the switch are the
   only exception, released as patch versions from the `ts-backend-final` tag.
2. Remove the replaced JavaScript and its tests together, in one teardown
   change, after tagging the last commit and capturing reference outputs.
3. Parity with the old backend is guidance only. The reference outputs and
   the old contracts are a checklist for cases the new spec missed or left
   undefined, not an oracle. Differences are triaged as improvement, spec gap,
   or regression, and the decision is written into the spec.
4. Formats keep counting: review result v8, public read model v7, change
   snapshot v4; no generated manifest exists (Decision 11). Every reader accepts exactly one number and
   rejects others with an actionable error. Numbers bump freely before 1.0,
   with no reader for the earlier number. Package 1.0.0 is the first stable
   format promise.
5. No backward compatibility with old output: no reader, shim, or migration
   for old manifests, caches, baselines, config shapes, or authoring modules.
   A base commit renders from its sources, so Changes works across the
   switch; a base whose sources fail current validation makes Changes
   unavailable with those diagnostics (Decision 11).
6. Mokly Cloud is reset and republished; its viewer and receiver update in the
   same window as the first release of the new core.
7. The upload exchange (plan, blob, complete; v1) and its validation rules do
   not change. They carry bytes and digests and never interpret the catalogue.
8. The first release of the new core is a 0.x minor version with a
   breaking-change release note.
9. HTML screens and components carry their front matter in a leading `---`
   block with the same delimiter rule as Markdown documents. No comment form
   is accepted, so there is one way to write it. Mokly's own attributes keep
   their short names, `mokly-viewport` and `mokly-instance`; strict HTML
   validity is not a goal of the format.
10. The sidecar bundles consumer JavaScript and reports the module graph;
    Rust owns invalidation and caching. Milestone 1 chooses between esbuild
    and Rolldown for that bundling and records why.
11. No committed generated tree (2026-10-12). Both sides of a comparison
    render from sources: the head from the working tree, the base from the
    base commit's Git tree, through one render graph and a bounded render
    cache; both sides use the current Mokly version. No command writes into
    the repository. The static output of `build` is a plain output that
    nothing reads back, and `publish` uploads it. This withdraws the earlier requirement to keep
    tracked and rebuilt output.
12. React and Storybook components, React screens, the renderer module, and
    consumer PostCSS at the base follow three dependency tiers (2026-10-12,
    widened 2026-10-13): an identical lockfile uses the working tree's
    dependencies; a different lockfile installs the base's dependencies into
    a bounded content-addressed cache with lifecycle scripts disabled under a
    time limit; an impossible install uses the working tree's dependencies
    with a warning.
13. Markers (2026-10-12): the core attaches ownership and ignore regions to
    tree nodes; comment markers exist only in the fragments a sidecar
    returns; ignore scopes resolve at render time; the `mokly-` prefix is
    reserved for element names in authored HTML and for comment names in
    fragments. A changed style rule that matches no element produces no
    evidence record. Amended by Decision 31 on 2026-10-14.
14. Two verbs (2026-10-13): `serve` and `build`. `build` validates the
    catalogue, renders every view, fails on errors and, with `--strict`, on
    warnings, and writes the static output into the directory `--out` names,
    `mokly-static/` at the repository root by default, which Git must ignore.
    `publish` builds into its own directory outside the repository and
    uploads. Amended on 2026-10-14 by the end-state rewrite: `serve`, `build`, and `publish` take `--base <ref>`, and `build` and
    `publish` take `--no-changes`; `publish` builds into a private directory
    that the terminal names and keeps after a failed upload. There is no
    `check` and no `export`; a validation-only run is a build to a temporary
    directory. Amended by Decision 36 on 2026-10-14.
15. Caches (2026-10-13): the render cache is process memory. The base-side
    extraction cache and the dependency install cache live outside the
    repository, in the operating system's cache directory under a key derived
    from the repository path, bounded by bytes and evicted least recently
    used; the terminal names the directory, and deleting it is safe. No
    command writes into the repository except `build` into its output
    directory.
16. Scope state (2026-10-13): the core sends the enclosing ignore scope state
    with each component render, the sidecar seeds its React scope context
    from it, the fragment cache key includes it, each slot placeholder reports
    the state at its position, which the core applies as the innermost scope
    of the slot content, and the core applies no outer scope to a fragment.
17. Handles (2026-10-13): `describe` returns every definition with a handle,
    the file path, `#`, and the export name; `renderScreen` and
    `renderComponent` name a definition by its handle and pass the props, and
    the fragment key holds the handle or the story id. Amended the same day
    under Decision 19: a variant is a props set and has no handle of its own.
18. Stories (2026-10-13): a stories file becomes one component entry at the
    path derived from the file, and each story becomes a variant of it with
    its `args` as props; the schema is inferred from the args, and `argTypes`
    enrich the derived controls (Decision 23). The read model and the viewer need no
    story kind.
19. One variant model (2026-10-13): every screen and component is a render
    over props with `propSchema`, `props`, and optional `variants` whose
    props replace top-level keys; the entry's own view renders its props;
    components need no variant and their page shows the own props first; a
    schema that is not declared is inferred from the saved props, and
    non-data values are excluded with a warning; controls derive from the
    schema; `defineScreen` takes `render(props)`; HTML screen and component bodies share one
    template language (Decision 24); read model v7 gives screens the component prop fields.
20. Prop schemas (2026-10-13): every prop schema, declared or inferred, is a
    JSON Schema 2020-12 object schema under the strict profile of the entry
    props contract: `type`, closed `properties` with `required` and
    `additionalProperties: false` (Decision 22), `enum`,
    `const`, `oneOf` of constants, `items` with the array bounds, the string
    and number bounds, `anyOf`, `title`, `description`, and `$schema`;
    `default`, `$ref`, and every other keyword are rejected. One validator on the `jsonschema` crate checks schemas and
    props in Rust; the viewer validates control input with a profile
    validator that generates no code; `json-schema-to-ts` derives the
    authoring types. Inference emits the profile, with a `type` list for
    mixed kinds and no `items` for an array empty in every set.
21. Client-rendered shell (2026-10-13): the Browse shell renders only in the
    browser. Serve and `build` deliver one identical stub page per shell
    route, the catalogue index v7 without per-view usage at
    `mokly-viewer/index.json`, and one entry detail v1 per entry with its
    usage, resource evidence, and workspace lists; Serve adds the live
    descriptor v3 at `mokly-viewer/live.json`. No process renders shell HTML,
    so the sidecar starts only for JavaScript rendering, and `renderShell`,
    the shell bootstrap, the delivery descriptor, hydration, the page-fetching
    route evidence, and the one-shot reload recovery are retired. No update
    reloads the page. `MoklyViewer` takes an index source and a detail
    source, and `renderViewer` goes. The
    [shell delivery contract](../docs/protocol/mokly-shell-delivery.md) owns
    the routes; the example-export measurements behind the decision are in
    `.context/rust-rebuild/shell-delivery-measurements-2026-10-13.md`.
    Amended on 2026-10-14 under Decision 27.
22. Prop schema details (2026-10-13): every object schema, the root included,
    carries `additionalProperties: false`, and a schema without it fails;
    inference reads the entry's own props and every variant's merged props,
    so the entry's own keys are `required` and a key only a variant adds is
    optional, and a `defineScreen` without `propSchema` is generic over its
    `props` literal with `Partial` variant props; a derived number control
    offers only valid values, with `multipleOf` as its step counted from zero
    and 1 for an `integer` without it, and no schema is rejected for the
    step; a derived select labels an option by its `title`, else the string
    itself, else the JSON text of the value.
23. Stories as control hints (2026-10-13, amends 18): the schema of a stories
    file is always inferred from the args; `argTypes` enrich the derived
    controls with options, bounds, step, name, and description, exclude
    non-prop args (`control: false`, `table.disable`, an `action`, a
    `function` type) without a warning, and never enter validation.
24. One template language (2026-10-13, amends 19): screen bodies and
    component bodies share one template language, `$name` references and
    coerced attributes on component elements, `{{name}}` substitution,
    `mokly-if`, and `mokly-viewport`, with slot placeholders in component
    bodies only; a body reads only its own entry's props, an undeclared
    reference fails with `html-props` in either body, and one parser and one
    renderer serve both.
25. One definition per export (2026-10-13): an export contributes exactly
    one definition; an array export fails with `array-export` naming the
    export, because no helper returns an array once a variant is a props set.
26. Pages (2026-10-13): the sidecar's `renderPage` runs a `definePage`
    callback by its handle and returns the complete document, its resources,
    and warnings; the core applies the pages contract's document rules to it.
27. One revision (2026-10-14, amends 21): the index carries one integer
    `revision` that Serve raises by one per publication, in place of the
    update version and the content and evidence revisions; each event stream
    message carries the revision as its id and no data, and a new connection
    receives the current revision at once; every detail view carries a
    `documentKey`, the hash of its rendered bytes, and the shell reloads only
    the frames whose key changed; a current entry's detail repeats the index's
    `deploymentId` and `revision`, while a removed entry's detail inside a
    comparison generation carries the generation and the snapshot id instead,
    so generation files never change; `build` hashes the output with the id
    fields zeroed and Serve keeps one `deploymentId` for the life of the
    process, so a different id always means a full page load; the index
    carries `base` and, in Serve, `live: { generation }`, and the live
    descriptor v3 carries only the render capability; a page's resource
    evidence and the workspace lists have typed shapes in the detail, and the
    catalogue page's v7 types are revised in place. This settles findings 1
    to 6 of the shell delivery review. Amended on 2026-10-14 under Decision 30.
28. Documentation reset (2026-10-14): protocol pages define the intended end
    state. No page describes the previous implementation, a former format, or
    delivery history; a page whose behaviour is not implemented starts with
    `Status: In progress under the Rust rebuild plan`, its only plan
    reference. The 24 pages that described only the previous backend are
    deleted now, the 78 pages that described it in part are rewritten now so
    that the whole specification is reviewed before code lands, the root
    README and the architecture pages follow the same rule, and the guides
    follow at their milestones. The previous protocol is `main` commit
    `0bbd737e`; the `ts-backend-final` tag pins it at the teardown. No test
    asserts protocol page content; the link check and the 250-line cap stay.
29. Plans (2026-10-14): every other plan is deleted, and their open
    follow-ups are void under this reset. `main` commit `0bbd737e` keeps the
    merged plans; the branch history before commit `d4bac78d` keeps the
    native engine plan.
30. Shell delivery settled (2026-10-14, amends 27): `documentKey` lives on
    the index's view, page, and document records, is the document node's
    input hash of the render graph, and exists before a render; the shell
    fetches the live descriptor whenever the index carries `live`, whose
    `generation` is the render generation that fences live prop renders for
    HTML and JavaScript entries alike; each event stream message carries the
    revision as its id and the server's `deploymentId` as its data, and a
    message with another deployment id is a full page load; the live
    descriptor v3 has a typed shape; a view's and a page's `resourceEvidence`
    is the review v8 `rules` and `resources` records with their owners, and
    the comparison contract defines `ResourceEvidence`; the workspace has no
    `status`; Serve sends no cross-origin header on any route; no page states
    server rendering or hydration; the shell delivery page names the
    comparison serving contract as the owner of the comparison routes; and
    per-view usage has no route of its own, so a detail carries `pending`
    until the next publication. This settles the open findings of the shell
    delivery reviews of commits 1fdf5d95, 62223201, and 7cb14ebf. Amended by
    Decision 34 on 2026-10-14.

31. Markers in output (2026-10-14, amends 13): served and built documents
    keep the `mokly-instance` and `mokly-slot` comment markers of every region
    the core composed, whatever rendered the instance, so the published
    inspector resolves `r-n` regions in the live page. Ignore regions resolve
    at composition, and the `mokly-link` marker of a `MockLink asChild`
    control is the fourth reserved marker; both are consumed and never
    written. Canonical form removes every marker before comparison. A
    stylesheet whose changed rules all match nothing on a view produces one
    `excluded` record with an empty selector, owned by the entry.
32. One render signature (2026-10-14): `defineScreen` and `defineComponent`
    take `render(props, context)`, where `context` is
    `{ viewport, colorScheme }` and a render may ignore it.
33. CSS Modules in the core (2026-10-14): the core scopes `*.module.css` on
    `lightningcss` after the consumer's PostCSS step and derives the class map
    with the path-hash naming rule; `bundle` compiles each module CSS import
    to a stub that reads the generation's map table, which the core supplies
    through the sidecar's `cssModules` call after `bundle` reports the graph and
    before `describe` evaluates the modules.
34. Live render fence (2026-10-14, amends 30): the live render request and
    response carry the installed `revision`, and Serve rejects an older
    revision with the stale-revision code; a change of the index's
    `live.generation` refetches the descriptor, replaces the capability, and
    rerenders the current validated props. There is no stale-generation code.
35. Wire literals (2026-10-14): `sourceKind` is always `"base"` and the
    `"generation"` kind does not exist; the instance and slot key domains are
    `mokly-instance-v1` and `mokly-slot-v1`; the move diagnostic reads
    `matched no removed base entry`.
36. CLI, packaging, and read model settlements (2026-10-14, amends 14):
    `serve` also takes `--base <ref>`; `publish` prints
    `Mokly publish build: <directory>` once, before its build; the viewer's
    public entries are the root, `./browser`, `./data`, and `./styles.css`;
    `packages/mokly` holds the `@mokly/mokly` shim, sidecar, and authoring
    API, and `src/` is deleted at the teardown; the `Changes ready` line
    reports the Changes count with the moved and ignored-only counts, zero
    segments omitted; every ready view and page of the entry detail carries
    `resourceEvidence` with both arrays, empty allowed.
37. Data-only configuration (2026-10-14): the configuration is
    `mokly.config.json`, read by the core, with a JSON Schema the package
    ships for editors; `--config` names another JSON file. A `$`-prefixed
    string in a stylesheet list is a token, and `$componentStylesheets` is the
    only token. There is no `defineConfig`, no TypeScript or JavaScript
    configuration, no sidecar at startup, and no configuration import to
    watch.
38. Documentation settlements (2026-10-14): the six duplicate pages
    (generated delivery, catalogue fetch, live capabilities, removed preview
    frames, publication changes, configuration discovery) merge into their
    owners and `verification-protocol-index.md` is deleted; the viewer package
    README, the xtask README, the guides, and `AGENTS.md` follow the end state
    now. The guides wait for the user's decision on the guide tests, recorded
    under the review TODO as item E.

39. Template spacing (2026-10-15): substitution accepts optional ASCII
    whitespace around the prop path inside `{{ }}`. `{{ name }}` equals
    `{{name}}` in text and attributes. The catalogue checker and HTML renderer
    use the same rule.

40. Static output parser (2026-10-15): keep Oxc for the module-request rules
    of `mokly-export-browser.md`. A real parser distinguishes regular
    expressions, division, comments, and decoded import strings. The added
    dependency closure has 32 crates. Licence classes are MIT, MIT/Apache-2.0,
    Unicode-3.0, and Apache-2.0 WITH LLVM-exception OR BSL-1.0 for
    `dragonbox_ecma`. Review Oxc's 0.x API changes with dependency updates.

41. Consumer-relative affected chains (orchestrator, 2026-10-19): accept review
    v8 `via` chains that start inside the named consumer and omit its own
    instance and outer ancestors. Contexts keep their side and variant address.
    A direct child has one chain element, including in another entry's view.
    This aligns the round 15 specification with the producer and the viewer's
    direct-use flag. Decision: M9 review 10 finding 3A, approved in changes-12.

**Decision 55 B (user, 2026-10-19):** Approve full isolated fixture setup below
60,000 ms and setup-family RSS below 1.5 GiB, including the setup harness.
Enforce these budgets after the isolated-install repair rather than retaining
observation-only results. Full setup includes generation, packing, dependency
installation, and Git setup. The product build is a separate prerequisite.

**Decision 57 C (user, 2026-10-19):** Keep the current complete-catalogue
startup design. Approve usable startup below 15,000 ms for the large React
fixture, cold and warm, on the optimized release binary. HTML retains its
5,000 ms budget. Defer compilation cache redesign, option A, and partial
readiness rather than blocking this acceptance round on further startup work.

**Follow-up decision defaults (F8):** These numbers identify the orchestrator's
follow-up list, not the architecture decisions above.

- **10 A:** applied by default (user rule), 2026-10-20. Base dependency installs
  support npm only. When installation is needed, pnpm, Yarn, and Bun fall back
  to working dependencies with `base-dependencies`. Equal dependency identities
  still use tier one. Document the limit and add pnpm and Yarn before the first
  release under option B. Corepack, option C, is not selected.
- **12 C:** applied by default (user rule), 2026-10-20. Registered JavaScript
  wrappers pre-check dynamic data props with the viewer's existing profile
  validator before their adapters run. The Rust fragment reader rechecks every
  returned instance against its registered schema. Verification found the Rust
  check in place; F8 adds the missing wrapper pre-check and its regression.
  No binary callback or WebAssembly validator is selected.
- **14 A:** applied by default (user rule), 2026-10-20. Declared component
  stylesheets remain delivery roots. Bundle their imports and assets, keep
  sources private, and fail on bundle errors. Align the component stylesheet
  pages with the configured local CSS model instead of linking sources as-is.
- **15 A:** applied by default (user rule), 2026-10-20. Keep rejecting `data:`
  and protocol-relative `//` URLs in HTML screen `href` and `src`. Authors
  reference image files; no `data:image/*` exception is added.
- **18 B:** applied by default (user rule), 2026-10-20. Keep the documented
  empty own-entry view of a slot component. Do not add caller slot content
  to a component's own entry.
- **21 B:** applied by default (user rule), 2026-10-20. Keep every component's
  Used by list unavailable for a generation if one view fails. Keep the
  documented copy and the workspace without a separate failed-render status.
- **26 A:** applied by default (user rule), 2026-10-20. Accept one PostCSS Node
  child per context in each sidecar, running in that side's source directory.
  Keep the combined 1 GiB recycle check for the sidecar and its Node children.
  Do not return to worker threads that expose the head's working directory.
- **28 A:** applied by default (user rule), 2026-10-20. Keep bundle parsing
  independent of package `type` and tsconfig parse settings. Only the source
  `@jsxImportSource` pragma selects a module's JSX import source. Document this
  policy; reconsider option B only if users need tsconfig JSX settings.
- **29 A:** applied by default (user rule), 2026-10-20. A stylesheet edit reloads
  every document that links the changed bundle. Keep keys based on emitted CSS
  and asset bytes, computable before render, rather than rule-level keys.
- **31 A:** applied by default (user rule), 2026-10-20. Keep the named list of
  43 design screens with no inbound artboard link. Review each area's entries
  when its design changes. Keep them separate from the 12 runtime-only states.
- **41 C:** applied by default (user rule), 2026-10-20. Add neither optional
  base-render hardening rule. Keep removing only `INIT_CWD`, `npm_package_json`,
  and `npm_config_local_prefix`; retain other inherited environment values.
  Keep `node_modules/.mokly-roots/` documented as reserved without a new
  rejection. Revisit either rule only after a real project encounters it.
- **59 A:** applied by default (user rule), 2026-10-20. Keep the current
  compiled-recipe lifetime under decision 57 C's performance-later rule.
  Mokly Cloud observations: a long Serve session compiled the same base six
  times. Default-setting probes crossed the external 4 GB guard during a later
  base compilation; esbuild reached 2.91 GB in the merged sample. These are
  observations, not a product memory bound. Do not add default Go environment
  settings under option B. Defer option C, a byte-bounded cache of unused
  compiled recipes revalidated before reuse, to the post-merge follow-up.

**F8 explicit user approvals:**

- **13 A:** approved by the user, decision 13 A, 2026-10-20. Delete the unused
  former catalogue fixtures `docs/protocol/fixtures/catalogue-v4.json`,
  `catalogue-v5.json`, and `catalogue-v6.json`. Architecture decisions 4 and 28
  replaced these formats. Remove their `.prettierignore` entries and settle
  the pending plan item. Searches found no live test, script, or README reference.
- **33 A:** approved by the user, decision 33 A, 2026-10-20. Approve the earlier
  rebuild deletion of `packages/viewer/src/navigation/reserved_attributes.ts`
  and the functions `lexical`, `validateComponentViews`, `isPortableUrlPath`,
  `resolveLinkPath`, and `effectiveColorSchemes`. This record authorizes those
  completed removals and makes no additional code change.

**Decision log items applied by default (user rule), 2026-10-20:** the user
did not answer these items of the orchestrator's decision log, so the named
option applies under the user's rule. Milestones 10.1 and 10.2 apply them.

- Item 17 A: accept the settled controls copy and states of the design
  catalogue, and adopt the controls mockup's rows with a label column in the
  viewer now. This approves the presentation change of the Milestone 10 copy
  work and the field layout.
- Item 24 A: below 760px, each use-case step shows its mobile view in a phone
  frame, as the use-case mockup does; the viewer and the
  [device chrome contract](../docs/protocol/mokly-shell-device-chrome.md)
  follow.
- Item 25 B: the component design and the mockups adopt the viewer's fixed
  1024px desktop canvas, so a component's desktop view has one layout width
  in every window.
- Item 32 A: Details explain a screen or component that only changed
  components affect when the review lists it in `affected` or a shown view
  keeps a component-owned record, in place of the no-changes line; the records
  page states that such an entry keeps `unchanged` views; the pane heading of
  such a view reads “Components this screen uses changed” (“variant” for a
  component); the design state comes first.
- Item 35 A: the `implementation` reason reads “Rendered content changed where
  this component is used.”, and the design catalogue depicts it.
- Item 38 C: a view reads the style-only heading when the entry has a reason,
  every reason is a `dependency`, each named path has a rule of any status on
  the view, and at least one named path has a `matched` or `unresolved` rule
  on the view.
- Item 42 A: comparisons adopt the design catalogue's missing-pane copy, and
  the [pane contract](../docs/protocol/mokly-comparison-panes.md#layout)
  names it.

**Decision log item 34 A (approved by the user, decision 34 A, 2026-10-20):**
delete the dead shell path `ShellContext.componentChanges` in
`packages/viewer/src/shell`, which only the deleted TypeScript backend set,
and the tests that reach their copy only through it. The live-path tests cover
the same copy.

**Approvals the user gave on 2026-10-12, recorded for the teardown:**

- Deleting content on `origin/main` for the teardown: the paths named in
  Milestone 2. The teardown commit restates them.
- The functioning-product rule is suspended between the teardown and the end
  of Milestone 7, when the viewer reads the served catalogue again, and from
  the end of every milestone that emits a new format until the end of the
  milestone in which the viewer reads it; today that is Milestones 9 to 10.
  The viewer package keeps working throughout.
- Pending the user's approval, under the rule that a new gate needs it: the
  Rust advisory audit, the generated-TypeScript byte-identity check, and the
  time and memory budgets of Milestone 14. Milestone 3 records the answer
  before adding any of them.

**Review decisions the user gave on 2026-10-12:** every live native engine
reference is repointed now; head styles, owned and unowned, leave the canonical
form; the behaviour-table script is written on this branch; the server
milestones serve the new formats and the viewer reads them in the milestone
that follows; `defineComponent` gains `element`; sidecar recycling thresholds
are fixed; the protocol triage stays under `.context/`; the documentation
policy page is kept; the four remaining format owners carry Delivery Status
pointers; the pull request description writes `{target}` for the placeholder.
Later that day the user chose render-time scope resolution with comment
markers only in sidecar fragments, the suspension principle for every
new-format gap, no evidence record for a rule that matches nothing, and the
one-word version repair on the component review page. On 2026-10-13 the user
also chose the sidecar's `describe` call as the source of JavaScript component
definitions and frozen wording for the two remaining retired-page targets, then
widened `describe` to every definition kind and the story inventory, fixed
the `ignoreScope` values as `enabled` and `disabled`, chose the definition
handle for render requests, and made Storybook stories component variants.
The same day the user normalised variants to one model for every kind and
adopted the JSON Schema profile for prop schemas, then settled the profile's
closed objects, inference sets, control step and labels, made `argTypes`
control hints, unified the template language, required one definition per
export, added `renderPage`, and approved pointers on the five frozen pages.
On 2026-10-14 the user settled findings 1 to 6 of the shell delivery review
through Decision 27.

**Architecture:**

- The `mokly` executable is a Rust binary shipped in `@mokly/native-<target>`
  platform packages, resolved by a small Node shim in `@mokly/mokly`. The
  binary owns discovery, the catalogue model, HTML composition, stylesheets,
  document assembly, a content-addressed render graph with parallel scheduling,
  watch, the server, comparison, the static build, and publish. No command
  writes into the repository; `build` writes its output directory.
- A pool of Node sidecars renders only JavaScript: a React component with
  props, a React screen, a Storybook story through portable stories, and a
  `definePage` document. A sidecar returns an HTML fragment plus the styles
  that render produced, or a page's complete document. The binary memoizes
  every fragment by the hash of bundle generation, handle, props, viewport,
  scheme, and enclosing ignore scope; a page by generation and handle.
- The Browse shell renders only in the browser, from the catalogue index and
  one entry detail per entry under the
  [shell delivery contract](../docs/protocol/mokly-shell-delivery.md). Serve
  and `build` deliver one identical stub page per route and never render
  shell HTML.
- Screens and components can be HTML files with YAML front matter. The format
  adopts the decisions of the HTML screens plan on branch
  `calummoore/yaml-vs-html-screens` (front matter keys, custom element names,
  kebab-case attributes coerced through prop schemas, variants, `mock:` links,
  ignore markers, and exact diagnostics) and adds HTML components: a front
  matter block with the element name, prop schema, and slots. Screen and
  component bodies share one template language, `$name` prop references,
  `{{name}}` substitution, `mokly-if`, and `mokly-viewport`, with named slots
  in component bodies. No loops or expressions in the first version.
- Comparison works on trees, not text. Both sides render from sources with
  the current version, the base from its Git tree under the dependency tiers
  of Decision 12. Ownership and ignore regions are node annotations, carried
  as comment markers only in sidecar fragments; an element's owner is its
  nearest enclosing region;
  materiality compares canonical trees after removing ignored regions and
  head styles, owned and unowned; styles count through rule evidence only.
  CSS attribution keeps today's rule-level matching and its
  conservative keep list, on the `lightningcss` and `selectors` crates.
  Inline style ownership for sidecar-rendered components comes from the render
  itself, so no inference is needed; whole-screen React entries get one simple
  rule stated in the spec.
- Every shared shape has one definition in a Rust model crate, and the
  TypeScript types are generated from it. Format bumps are one edit.
- Rust conventions follow the shared `rust` skill that `AGENTS.md` names:
  trait seams, `dyn` dispatch,
  `unimock`, `thiserror`, `tracing`, 300-line files, `_tests_` directories.

**Non-goals of this plan:** changing the viewer's presentation beyond the
design defaults of decision log items 17, 24, and 32;
compatibility readers; a pure YAML screen format; loops or expressions in HTML
bodies; pixel comparison.

## Order of work

The milestones run in order on one branch. Milestones 1 and 2 remove the old
backend; Milestones 3 to 6 restore a CLI that serves HTML catalogues;
Milestones 7 to 13 add the sidecar, Changes, watch, the static build, publish,
and release packaging; Milestone 14 proves scale; Milestone 15 closes the plan.
Each milestone runs the gap sweep of Milestone 1 for its subsystem before it
closes. Milestones tagged `ui` change only the viewer package.

## Milestone 1: Architecture spec and contracts

Documentation only. At completion the new spec set defines the rebuild
without guesswork, and every protocol page is classified.

- [x] Write `docs/architecture/rust-core.md`: the crate layout, process
      topology (shim, binary, sidecar pool), the build graph and its cache
      keys, the tree-based comparison model, memory bounds, and the format
      inventory with the numbers of Decision 4.
- [x] Write `docs/protocol/mokly-sidecar.md`: the sidecar lifecycle, the
      newline-delimited JSON requests and responses for component, screen,
      story, and shell renders, the style-collection rule, the fragment cache
      key, cancellation, timeouts, and the fail-closed rules.
- [x] Write `docs/protocol/mokly-html-screens.md` and
      `docs/protocol/mokly-html-components.md` from the HTML screens plan's
      decisions and the HTML component format above, each with one worked
      example and exact diagnostics, with the `---` front matter rule of
      Decision 9, and with the file kinds for pages, flows, and use cases
      that need no JavaScript (YAML or HTML files, decided here).
- [x] Decide and record the sidecar bundler (Decision 10), the consumer
      PostCSS worker, the React style-collection rule, and the Storybook
      portable-stories entry.
- [x] Write `docs/protocol/mokly-comparison.md` and revise
      `mokly-css-attribution.md`: tree materiality, marker-derived ownership,
      the inline style rule for whole-screen entries, Changes membership,
      review result v8, and change snapshot v4.
- [x] Revise `mokly-catalogue.md`, `mokly-format-versions.md`,
      `mokly-paths.md`, `mokly-folders.md`, `mokly-variants.md`,
      `mokly-moves.md`, and `mokly-documents.md` to the new numbers and the
      tree model; state that no earlier number is readable.
- [x] Classify every page in `docs/protocol` as keep, rewrite, or delete, with
      one reason each, in `.context/rust-rebuild/protocol-triage.md`; put the
      resulting index in `docs/protocol/README.md`. The upload exchange pages
      and fixtures are keep, unchanged.
- [x] Write the gap-sweep procedure and the reference-capture procedure into
      `docs/dev/rebuild.md`: which scenarios to capture, the behaviour-table
      script, and the triage bins of Decision 3.
- [x] Update `README.md`, `docs/dev/documentation.md`, `AGENTS.md` where they
      assume the TypeScript backend, and add the breaking-change note to
      `docs/protocol/npm-release-notes.md`.
- [x] Validate Prettier, links, protocol sizes, and the documentation tests.
- [x] Commit.

Outcomes recorded in the contracts: the screen suffix is `.screen.html`
(not `.mockup.html`) so HTML screens, components and pages share one naming
rule; pages are `.page.html` and use cases `.use-case.yaml`; the sidecar
bundles with esbuild because the frozen backend's plugin behaviour ports
directly and its metafile is the module inventory, with Rolldown reviewed
after the first release; the bundle generation is the fragment cache key; and
styles are collected per render. The protocol triage is
`.context/rust-rebuild/protocol-triage.md`: 77 pages kept, 81 rewritten by
their owning milestones, 14 retired at the teardown.

## Milestone 2: Reference capture and teardown

At completion the protocol set describes the end state, and the branch holds
the viewer, the authored example content, a trimmed `xtask`, and a green
reduced gate. No CLI exists
until Milestone 6. `main` keeps the old backend until this pull request
merges; the freeze applies to it from 2026-10-12.

- [x] Documentation reset (Decision 28): delete the 24 pages that described
      only the previous backend, strip every status section and history
      pointer from the remaining pages and READMEs, mark the 84 new and
      rewritten pages `In progress`, regroup the protocol index by subject,
      and rewrite the documentation policy and the rebuild procedures.
- [x] Delete the protocol-content tests (`component_protocol_docs`,
      `protocol_structure`, `protocol_split_links`, `protocol_doc_history`,
      `path_protocol_examples`, `design_links_inventory`,
      `design_screen_counts`, `imported_styles_error_catalogue`) and the
      protocol-page assertions inside six other test files.
- [x] Delete every other plan (Decision 29).
- [x] Rewrite the root `README.md` and the architecture pages to the end
      state.
- [x] Rewrite the 78 pages that described the previous backend in part, by
      subject, each at or under 250 lines with the `Status` line:
  - [x] authoring;
  - [x] rendering;
  - [x] comparison and Changes;
  - [x] read model and delivery;
  - [x] Serve, watch, and the CLI;
  - [x] static build and publish;
  - [x] viewer;
  - [x] design mockups;
  - [x] CI, verification, and release.
- [ ] Confirm the landable pull requests merged: #135, #182, and the test and
      CI housekeeping; the user merges them.
  - [x] #135: closed unmerged by the user's decision on 2026-10-20, because
        #168 replaced its behaviour.
  - [x] #182: merged on 2026-10-20 as `b19d4433`. It released
        `@mokly/mokly` 0.15.0 and `@mokly/viewer` 0.6.0.
  - [x] #198: merged on 2026-10-20 as `d9f421d1` by the user's decision. CI
        also runs on a manual dispatch for any branch.
  - [ ] The test and CI housekeeping pull requests: the user decides each
        open pull request.
- [x] Tag the last TypeScript backend commit on `main` as `ts-backend-final`:
      `b19d4433`, the 0.15.0 release, tagged on 2026-10-20.
- [x] Write `scripts/rebuild/behaviour-table.mjs` on this branch: it reduces one
      captured scenario to the JSON table that the rebuild procedures define.
- [x] Capture reference outputs with the old CLI under
      `.context/rust-rebuild/reference/`: the example catalogue, the large
      fixture's four scenarios, and the moved, removed, Markdown document,
      ignore-region, and renderer-change states; run the behaviour-table
      script over them.
- [x] Delete, with the recorded approval: `src/`; the backend tests under
      `tests/` except the documentation, guide, and workflow policy tests that
      still apply; `scripts/package`, `scripts/preview`, `scripts/large`, and
      the verification runners that drive the old CLI; the
      preview deployment workflow; and the root package's `bin`, `exports`,
      `files`, and publish configuration.
- [x] Repoint or remove every live reference to the native engine contract
      before the teardown deletes `docs/protocol/mokly-native-engine.md`.
- [x] Trim `xtask`: the repository suite keeps the audit, Prettier, ESLint,
      the length audits, Rust formatting, Clippy, tests, and the file-length
      audit; a viewer suite runs the viewer typecheck and tests and the tooling tests
      under `tests/`; the package,
      unit, browser, and hydration suites and their remote shards are removed
      until later milestones add new ones.
- [x] Update `.github/workflows/ci.yml`, `release-please-config.json`, and
      `.release-please-manifest.json` for the reduced tree; keep the viewer
      release path.
- [x] Update `AGENTS.md` for the reduced tree: the commands, the repository
      rules, and the moment to read the `rust` skill, which then covers
      `crates/` as well as `xtask/`. Done on 2026-10-14 under Decision 38,
      ahead of the teardown.
- [x] Run `cargo xtask check` on the reduced tree until it passes.
- [x] Record the deleted top-level paths in the commit body.
- [x] Commit.

- [x] Apply the first M2 review fixes: restore release and workflow checks,
      make reference tables independent of legacy ids, and capture
      `stylesheet-edit` with used and unused CSS rules.

Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/reference/README.md`; sweep: `/home/vercel-sandbox/mokly/.context/rust-rebuild/sweeps/m2.md`.
Review-fix evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m2/report-2.md`.
Second review-fix evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m2/report-3.md`.

## Milestone 3: Workspace skeleton and native packaging

At completion the Rust workspace builds, the `mokly` binary runs `--help` and
`--version`, and the platform packages, shim, and CI build steps exist.

- [x] Add the crates: `mokly-model` (shared shapes, canonical JSON, the prop
      schema profile and its validator on the `jsonschema` crate, generated
      TypeScript), `mokly-cli` (the binary, clap grammar, terminal output),
      `mokly-platform` (exclusive rename, process groups, Windows job objects),
      `mokly-git` (command runner, bounded batches), and `mokly-sidecar` (the
      client of the sidecar protocol). Later milestones add their own crates.
      Each crate has a README with the required sections.
- [x] Add the five `@mokly/native-<target>` platform packages linked from the private root, the shim in `@mokly/mokly` under `packages/mokly` that resolves the
      binary and checks versions, and the
      `cargo xtask build-native` and `generate-types` commands; `npm run build`
      builds the host target.
- [x] Resolve native installation with optional file links from the private root.
      The native packages stay outside npm's workspace list. The public CLI
      keeps exact registry versions. Approved in Milestone 3 change request 1.
- [x] Extend `xtask check`: Rust formatting, Clippy, tests, file length, and
      the viewer suite. CI builds the native artifacts in every job and on
      the Testbox through `rust-toolchain.toml`. The Native suite runs on
      hosted macOS and Windows runners.
- [x] Add `cargo xtask check-generated-types` as a standalone byte-identity
      check. Keep it outside every gate and CI job.
- [ ] Record the gate approvals from the Status section before adding the gates.
      The generated-TypeScript byte-identity and Rust advisory audit gates
      wait for the user.
- [ ] After user approval, add `cargo xtask check-generated-types` and the
      Rust advisory audit to the Repository suite and CI.
- [x] Apply review 2 findings 1 to 8: isolate xtask builds, preserve LF text,
      cover generated sidecar types and Native commands, align the Testbox
      docs, keep Required CI as an aggregator, and enforce Git's 64 MiB cap.
- [x] Commit.

Round 3 decision: Required CI only aggregates results and reports. Every job
that runs checks, and the Testbox, builds the host native artifact.

Evidence: `.context/rust-rebuild/delegation/m3/report-1.md` and
`.context/rust-rebuild/sweeps/m3-phase-a.md`. Round 1 fixes and evidence:
`.context/rust-rebuild/delegation/m3/report-2.md` and
`.context/rust-rebuild/sweeps/m3-r2-git.md`.
Phase B evidence: `.context/rust-rebuild/delegation/m3/report-3.md`,
`.context/rust-rebuild/delegation/m3/merge-decisions.md`, and
`.context/rust-rebuild/m3-phase-b-complete-gate.log`.
Round 3 evidence: `.context/rust-rebuild/delegation/m3/report-4.md`,
`.context/rust-rebuild/m3-r3-renormalize.log`, and
`.context/rust-rebuild/m3-r3-complete-gate.log`.

## Milestone 4: Catalogue model and discovery

At completion `mokly build` discovers a catalogue of HTML screens, HTML
components, Markdown documents, pages, and use cases, validates it, builds the
catalogue model, and reports diagnostics; rendering and output follow in later
milestones.

- [x] Implement roots, default globs, folder records, path identity, variants,
      moves hints, and the diagnostics of the identity contracts in
      `mokly-catalogue`.
- [x] Implement the front matter parser and the file kinds decided in
      Milestone 1, with exact diagnostics and line and column reporting.
- [x] Implement the catalogue model in `mokly-model` with canonical JSON and
      the generated TypeScript types; it lives in memory, with no file on
      disk.
- [x] Behaviour tests from fixtures: one catalogue per identity rule, every
      diagnostic, and the reference catalogue's entry set.
- [x] Add the data-only configuration loader and editor JSON Schema, the
      source-tree interface and working-tree adapter, and the definition-provider
      boundary for the sidecar.
- [x] Define public index v7, detail v1, and live descriptor v3 shapes, generate
      their TypeScript modules, and gate reader versions before payload fields.
- [x] Wire the discovery-only build command, warning reports, and strict mode.
- [x] Run the repository gate, Rust checks, type regeneration, package build,
      and the built shim smoke fixture.
- [x] Complete the full gate after integration with the Milestone 2 teardown.
      Recheck the example documentation links after its port.
- [x] Commit the implementation checkpoint. The number-policy decision remains open.

Evidence: `.context/rust-rebuild/sweeps/m4.md` and
`.context/rust-rebuild/delegation/m4/report-1.md`.
Integration evidence: `.context/rust-rebuild/delegation/m4/report-2.md` and
`.context/rust-rebuild/delegation/m4/merge-decisions.md`.
Review 1 fixes and evidence: `.context/rust-rebuild/delegation/m4/report-3.md`.
Final fixes and evidence: `.context/rust-rebuild/delegation/m4/report-4.md`.

## Milestone 5: HTML rendering and the render cache

At completion `mokly build` validates, renders HTML screens and components
into the bounded render cache, and reports diagnostics; it writes its output
from Milestone 12.

- [x] Implement HTML components and the entry props model in `mokly-html`:
      prop schemas under the JSON Schema profile with closed objects and
      their inference from merged props, props-driven variants, scalar
      coercion, one template language for screen and component bodies
      (`$name` prop references, `{{name}}` substitution, `mokly-if`,
      `mokly-viewport`, named slots), `mokly-instance`, and the component
      registry with the reserved `mokly-` prefix.
- [x] Implement screen composition: viewports, colour schemes, stylesheet
      rules, document assembly, `mock:` link rewriting, ignore regions with
      their scopes resolved, and the ownership annotations the comparison
      relies on.
- [x] Implement the render cache: content keys, the byte bound, eviction, and
      reads through the existing `mokly-source-interface` for working and Git
      trees; the `build`
      validation run with `--strict`; and the closure of referenced assets for Serve and the
      static output.
- [x] Implement stylesheet handling on `lightningcss`: imports, assets, and
      per-root bundles.
- [x] Port the example catalogue's HTML-only parts and add HTML fixtures; run
      the gap sweep against the rendering contracts; the example README
      follows.
  - [x] Replace `examples/basic/mokly.config.ts` with `mokly.config.json`
        under Decision 37.
  - [x] Add the example's HTML Team area: two screens with a variant, three
        HTML components with variants and slots, a page, a use case, a
        folder record, and a Markdown document.
  - [x] Rewrite `examples/basic/README.md` to the end state.
  - [x] Add HTML fixtures and run the gap sweep against the rendering
        contracts.
  - [x] Render the example's HTML part and check it at both viewports and in
        both schemes. Its stylesheets pass through the example's PostCSS
        module, which runs in the Milestone 8 sidecar.
- [x] Write the HTML authoring guides under `docs/guides`.
- [x] Commit.

Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/sweeps/m5.md`.
Integration evidence: `.context/rust-rebuild/delegation/m5/report-2.md` and
`.context/rust-rebuild/delegation/m5/merge-decisions.md`.
Review fix evidence: `.context/rust-rebuild/delegation/m5/report-3.md`.
Final fix and merge evidence: `.context/rust-rebuild/delegation/m5/report-4.md`
and `.context/rust-rebuild/delegation/m5/round-3-merge-decisions.md`.

The Git source-tree adapter is part of Milestone 9. The example port remains
assigned to its separate task.

Example port evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m5-example/README.md`.
HTML fixture sweep and controls evidence: `.context/rust-rebuild/sweeps/m5-html.md`
and `.context/rust-rebuild/delegation/m8-core/report-9.md`.
Final sweep review fixes and static/Serve evidence: `.context/rust-rebuild/delegation/m8-core/report-10.md`;
merge decisions: `.context/rust-rebuild/delegation/m8-core/merge-decisions.md`.

## Milestone 6: Serve

At completion `mokly serve` serves an HTML catalogue: the shell stub on every
shell route, the catalogue index v7, one entry detail per entry, the
documents, the live descriptor, the update event stream, and shutdown; the
viewer renders it after Milestone 7. No sidecar starts for a catalogue
without JavaScript.

- [x] Restore `npm run dev` to serve `examples/basic/mokly.config.json` with
      argument forwarding.

- [x] Implement the server in `mokly-server`: the stub, the index and entry
      detail routes with `Cache-Control: no-store`, the document and asset
      routes, the live descriptor, the event stream with the revision as the
      message id and the deployment id as its data, shutdown ordering, and
      the terminal output contract in the CLI.
- [x] Complete context-aware usage readers: validate recorded props against
      component schemas; recompute instance and slot keys and `propsKey` with
      the shared material key; validate usage references, ownership cycles,
      source locations, duplicate records, root ranges, and view ordering.
- [x] Behaviour tests: every route of the shell delivery contract that
      Milestone 6 serves, the identity and revision fences, and shutdown.
- [x] Treat repeated SIGINT delivery as one Serve shutdown request. The
      POSIX shim may forward a console signal already delivered to the binary.
- [x] Queue manual rebuilds from rich Serve, atomically replace their public
      state and document backend, and keep last-good state on a failed candidate.
- [x] Commit.

Merge decisions: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m6/merge-decisions.md`.
Gap sweep: `/home/vercel-sandbox/mokly/.context/rust-rebuild/sweeps/m6.md`.
Smoke and screenshots: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m6-smoke/`.
Verification and report: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m6/report-1.md`.
Integration report: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m6/report-2.md`.
Review fixes and smoke: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m6/report-3.md`.
Viewer key domains and complete smoke: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m6/report-4.md`.

Final review fixes and integration: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m6/report-5.md`.

## Milestone 7: Viewer reads read model v7

Tags: ui

- [x] Update the viewer's data readers and validators to the generated read
      model v7 types.
- [x] Show a component's own props before its variants, offer the derived
      controls on screens with the zero-based step and the title-or-value
      select labels, and validate control input with a profile validator
      that generates no code, under the entry props contract; no
      other presentation change.
- [x] Replace server rendering and hydration in the viewer package with the
      client-rendered shell of the shell delivery contract: the `browser`
      entry mounts into the stub, index and detail readers replace
      `readCatalogue` and the bootstrap readers, `MoklyViewer` takes the
      index and detail sources, the `server` entry and `renderViewer` go,
      and the package README, rewritten under Decision 38, is checked
      against the package.
- [x] Run the viewer suite against the Milestone 6 routes.
- [x] Commit.

Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m7-checks/`; sweep: `/home/vercel-sandbox/mokly/.context/rust-rebuild/sweeps/m7.md`.
Merge decisions: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m7/merge-decisions.md`.
Serve run (log, results, screenshots): `/home/vercel-sandbox/mokly/.context/rust-rebuild/m7-serve-run/log.md`.

## Milestone 8: Sidecar rendering for JavaScript

At completion React components, React screens, JavaScript pages, and
Storybook stories render through the sidecar, and the example catalogue
renders again.

- [x] Apply browser review 7: exact affected destinations, isolated base
      commits, semantic waits, and required console notices.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m8-browser/report-11.md`.
      Merge decisions: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m8-browser/merge-decisions-3.md`.

- [x] Replace the configured-renderer refusal in both Serve and `build` with
      the sidecar bundle's complete source inventory (Milestone 6 review, finding 13).
- [x] Implement the sidecar protocol in `@mokly/mokly` and `mokly-sidecar`:
      process pool, newline-delimited JSON, cancellation, timeouts, and the
      fail-closed rules.
  - [x] Add the standalone Node entry, bounded NDJSON, method dispatch,
        exact-version hello, and the Rust pool's lazy process lifecycle.
  - [x] Test request deadlines, retry, recycling, shutdown, and queue
        cancellation with mocked Rust boundaries and real Node processes.
  - [x] Separate head and base generations, replay disposed generations on
        every worker, share canonical model wire values, and validate the
        CLI timeout override.
  - [x] Apply the approved resolved bindings, usage drafts, PostCSS contexts,
        and fragment-scoped registry style collection.
- [x] Implement consumer bundling in the sidecar with the bundler of Decision
      10, the module graph report, the consumer renderer module, React
      resolution from the consumer, and the optional consumer PostCSS worker.
  - [x] Add unevaluated esbuild generations, attributed facades, the JSX
        development shim, CSS Modules tables, and consumer style collectors.
  - [x] Map workspace PostCSS presets into each side and keep installed
        JavaScript and CSS under stable dependency graph names.
  - [x] Add the PostCSS worker and preserve local module locations, plugin
        creation lifetime, and dependency plugin names and globs.
- [x] Implement component, screen, page, and story renders, with
      `defineScreen` rendering over props, `json-schema-to-ts` for declared
      schemas and the `props` literal type for undeclared ones, schema
      inference for screens and stories, and `argTypes` as control hints; implement the fragment cache in
      Rust keyed by bundle generation, binding table, effective entry, class-map
      digest, handle, props, viewport, scheme, and
      the enclosing ignore scope; slot placeholders report their scope state;
      a stories file is a component entry whose stories are its variants.
  - [x] Add the authoring API with schema and literal prop inference, and
        standalone component, screen, story, and page renders.
  - [x] Connect resolved catalogue paths, complete usage records, schema
        validation, and fragment caching through the approved binding.
- [x] Implement `describe`: every definition the entry modules and stories
      files export, one per export, rejecting arrays containing definitions, with the
      story inventory; feed every definition into the
      catalogue model, and register JavaScript components by `element` with
      the uniqueness rule, the reserved `mokly-` prefix, and the reserved-prop
      failure of the components contract.
- [x] Reconcile the rendering page's authenticated fragment placements and
      logical inputs with the sidecar's typed instance and slot render-result
      records before connecting the Milestone 5 composition boundary.
- [x] Connect the Milestone 5 fragment and CSS interfaces: capture authenticated
      input and marker-placement metadata in the sidecar, resolve definition
      handles to catalogue identities, and supply the bundle generation,
      delivery roots, and component stylesheet lists to the native graph.
- [x] Extend the definition-provider boundary for `describe` handles,
      declared controls, story control hints, slot handles, excluded non-data
      prop keys, and authoring diagnostics; emit `props-not-data` after path
      derivation names the entry and key.
- [x] Implement live prop editing in Serve through the same render path.
  - [x] Add the shared `RenderGeneration::render_props` path with Rust prop
        validation, fragment caching, document composition, and closure checks.
  - [x] Wire the Serve live render route to the shared JavaScript runtime.
- [ ] Restore the example catalogue, the design catalogue, and a packed
      consumer smoke; run the gap sweep against the old rendering and
      component contracts.
  - [x] Read and classify the previous rendering and component rules and tests
        for the core integration gap sweep.
  - [x] Compare captured example and large scenarios after the example port
        and comparison integration land.
        Evidence: `.context/rust-rebuild/sweeps/m9-references.md`.
        The remaining large Changes artifacts belong to the M9 large-fixture gap.
  - [x] Add the callback-only regressions from the M5 HTML sweep: conflicting
        inputs from impure slot replay, renderer mutation isolation, and the
        page helper call count. Cover and document the render-time failure of
        a component wrapper whose definition is not exported by an entry
        module. Cases 30, 32, 36, and 127 remain assigned here; native
        templates cannot exercise callback side effects or wrapper exports.
        Evidence: `.context/rust-rebuild/delegation/m12-static/report-13.md`.
        Merge decisions: `.context/rust-rebuild/delegation/m12-static/merge-decisions.md`.
  - [x] Port the React example, the React components, and the design
        catalogue to the authoring API.
  - [x] Render both catalogues through the integrated sidecar and check every
        page at both viewports and in both schemes.
  - [x] Add the packed consumer smoke.
- [x] Update commands and test names in `examples/basic/README.md` and
      `examples/basic/specs/design/library/README.md` for the restored CLI.
- [x] Restore the example typecheck; validate or replace the viewer browser
      fixtures, including their component paths and cross-origin setup.
  - [x] Restore the example typecheck: the root typecheck includes the
        example.
  - [x] Validate or replace the viewer browser fixtures, including their
        component paths and cross-origin setup.
- [ ] Complete browser coverage for copied static output.
  - [x] Build and copy the example in global setup and run exact-file static
        checks in the normal four shards: navigation, inspection, no live
        endpoints, read-only props, resources, canonical links, deployment
        replacement, and public CORS. Port the current-only static/export/publish
        sweep cases and the design journeys.
  - [x] Add comparison modes and historical documents from a copied native
        build of an independent two-commit fixture. Cover removed screens,
        pages, documents, components, and variants, and retain the comparison
        URL across reload and viewer-only deployment replacement.
  - [x] Apply browser review 3: start copied builds with Serve readiness,
        preserve current-only filter omission and resized width on reload,
        centralize the exact recorder notice, and track clocks per context.
        Prove automatic console and page-error rejection with isolated probes.
  - [x] Apply browser review 4: wait for deployment reload and replacement
        CSS, cover Both viewport comparisons, use the saved scroll preference,
        bound negative probes within their owner, and correct sweep ownership.
  - [x] Split the Serve and copied-static design workspace loops into five
        groups of at most twelve screens. Check exact inventory coverage at
        module load and retain every per-screen assertion and leaf title.
  - [x] Give the isolated link-control catalogue a 180-second setup budget
        in its `beforeAll` hook. Keep the 60-second test timeout.
  - [x] Prepare browser review 5 sweep input fixes: remove stale M12 work,
        specify parameter-free static Refresh reads, and reject M12 reasons
        on non-dropped rows.
  - [x] After the final viewer merge, reconcile comparison row ownership
        and regenerate the browser sweep with the prepared input fixes.
  - [x] Cover the remaining copied-file delivery cases in the browser sweep:
        branch-point references, moved and removed previews, malformed
        comparison metadata, lazy first reads, immutable bytes, and Refresh
        request counts. Milestone 10 owns the
        remaining comparison UI checks, including frame color-scheme.
  - [x] Apply browser review 6: comparison view-switch request counts,
        copied affected references, misplaced Before-file rejection, moved
        fixture shapes, semantic edit readiness, and exact blank-frame notices.
        Evidence: `.context/rust-rebuild/delegation/m8-browser/report-10.md`.
        Merge decisions: `.context/rust-rebuild/delegation/m8-browser/merge-decisions-2.md`.
  - [ ] Add continuous `MOKLY_PLAYWRIGHT_FILE_DIR` runs in CI only after the
        user approves the new job. Include the private slot and variant file
        fixture and the design journeys checked by a manual run.
- [x] Restore the browser suite against `mokly serve` of the example: its
      four shards, the six remote Testbox commands, and the five-report
      aggregate that the CI verification and remote verification contracts
      define.
- [x] Add browser specs for the client-rendered shell: the stub mount, history
      routing, detail loading and retry, live publications without a page
      load, and the frame reload by `documentKey`; and the live prop edits:
      the 150 ms debounce, the rerender after a revision adoption or a
      `live.generation` change, the retry after a 409, cancellation on
      navigation, and read-only controls while no descriptor is installed.
- [ ] Complete the M8 viewer cases assigned by the browser sweep, including
      route/detail races, frame handoff, live prop edits, and preserved focus.
  - [x] Port the route, history, detail fence, mount, publication, and live
        edit cases.
  - [x] Port the cases that stay under the viewer client-shell TODO in the
        sweep: mount-time frame ownership and the Browse exact-resource
        handoff; live edit validation, the viewport switch, an expired
        preview, and a context change during a pending render; the React
        example components with their Usage consumers, actual contexts, and
        inspector tabs; the design library's unset, Reset, and nested styles;
        an older response for the same route; use-case and page frames and
        the Usage loading state while evidence is unavailable; instance deep
        links; and a published scheme swap while a redirect replaces a frame
        source.
  - [x] Port the review-base sentence while a detail loads, on the copied
        comparison output.
  - [x] Port the two remaining cases on `tests/browser/serve_comparison_test.ts`:
        focus on an unchanged Usage link while a Changes completion is
        adopted, which needs a changed component with a consumer; and the
        design library component's Unmodified status after temporary edits
        and Reset, which needs an unchanged component with editable props in
        the fixture's base commit. Done on 2026-10-20 by `c0c9f0ad`
        (`serve_usage_focus.spec.ts`, Card and its consumer) and `cbb51db2`
        (`serve_temporary_props_status.spec.ts`, Tag). The focus case found
        that the completion replaced Used by rows whose comparison
        eligibility changed. Fixed by `5d918352`.
  - [x] Publish no new revision for a render completion that changes no detail,
        while recording its route as completed. Restore one index read
        (`toHaveLength(1)`) in the 409 spec of `shell_live_edits.spec.ts` and the
        exact revision in the first half of its adoption spec. Review 8 finding
        1, for the Serve owner. Implementation: `3961636d`.
        The red run on the old code failed five of the six new Rust tests.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/round-12/browser-observations.json`.
- [x] M8 browser follow-up: make unexpected console errors and `pageerror`
      failures automatic for every browser page, with explicit per-test
      allowances for expected failures. Keep the shared sandbox notice rule.
- [x] M8 browser follow-up: add Serve browser specs for the example's HTML
      screens, slot components, document page, and YAML user flow under
      `examples/basic/specs/example/team`, including native HTML screen links.
      Evidence: `.context/rust-rebuild/delegation/m12-static/report-14.md`.

- [ ] Add the design catalogue checks that the verification and adoption
      sections of `mokly-design-components.md`,
      `mokly-design-component-library.md`, `mokly-component-design.md`, and
      `mokly-design-links.md` define.
  - [x] Restore current design artboards, library samples, the frozen screen
        inventory, shared component consumers and ownership, portable links,
        controls, and both viewport layouts through Serve.
  - [x] Portable design links, shared samples, and inspector disclosures
        directly from real `mokly build` output through `file://` URLs are
        checked by a manual run.
  - [ ] Complete the remaining design checks with their feature owners:
        M8 viewer owns live props; M9/M10 own stylesheet attribution and
        comparison output; M8 browser owns the static build acceptance checks.
  - [x] Check one served example in `tests/design_catalogue.test.ts`: the
        frozen inventory, the shared components and their consumers, family
        adoption, owner chains, stylesheet links and scopes, scripts, link
        targets and focus stops, control destinations, tag states, and
        reachability; prove each check with one mutation.
  - [x] Apply review 3 of the served checks: drain Serve's process group on
        every path, serve with `--base HEAD`, add the adoption table's family
        parts and the component explorer destinations, exempt only the brand
        link from the current-page mark, report non-anchor link markers, match
        every library root by class token, and make reachability one-way with
        the contract's runtime-only states.
  - [x] Add the browser checks with the restored browser suite: pointer and
        Tab/Enter activation, history, canonical outer URLs, preserved outer
        viewport selection, active rows, selection semantics, counts, missing
        states, highlighting and mask geometry, editable and read-only
        controls, standalone versus in-screen geometry, icons and carets,
        desktop divider alignment, comparison bars, the stacked frames, mobile
        sheets, responsive overflow, bounded scrolling, and portable link round
        trips.
  - [ ] Add the Changes checks after Milestone 9: the attribution matrix, one
        classification of the nine shared sheets per scenario, the rule
        records and the changed-entry union, and bounded base-side Git
        batching.
  - [x] Add the Rust behaviour tests over the design catalogue after
        Milestone 9: a parent component renders its own views from its own
        props, the stacked frames' structure, every comparison caption tied to
        its recorded change, and the Checklist's Changes.
        Evidence: rebuild/m8-design-behaviour 82da46a1 (four tests in
        crates/mokly-cli/tests/design_behaviour_tests.rs); review follow-ups are
        tracked by the orchestrator.
  - [x] Exercise the same journeys in the static output under the M8
        copied-static-output TODO, and cover the Review snapshot link fallback.
  - Keep the three design inventories aligned when a design changes:
    `tests/fixtures/design/inventory.json`,
    `tests/fixtures/design-library/browser-inventory.json`, and
    `tests/fixtures/design-library/screens.json`.
- [x] Add a browser spec for safe stage centring (Milestone 6 review 1,
      finding 7): at a narrow width, for example 1000 x 800, the component
      stage with both viewports starts its row at the stage's left edge and
      scrolls to the row's end, and a stage row that fits stays centred.
- [x] Port the viewer's frame inspector to the markers of the comparison
      contract (Milestone 7 Serve run): `inspector/ranges.ts` reads
      `mokly-component:start:r-N`, while Serve writes `mokly-instance` and
      `mokly-slot` markers with an `id` and leaves a component page's root
      region `r-0` without a marker. In Serve, hovering a screen frame turns
      it to the error state and disables Highlight components.
- [x] Port the Milestone 7 presentation into the design catalogue and settle
      its copy there (Milestone 7 review 1, finding 10 and the mockup gaps):
      the parent's own entry first in the variant bar, controls on screens,
      the stage loading state, the index failure state, the version failure
      state, the Props tab label against the mockups' "Controls", and the
      controls copy "Choose an available entry to edit props.",
      "Comparisons show the saved props. Return to Current to edit props.",
      "Open this catalogue locally to edit props." (also shown in Serve while
      the descriptor loads), "No editable props are declared for this
      entry.", and "Check the highlighted values." for a whole-props error
      that highlights no field.
- [x] Settle the component stage layout in the design port: with Both, the
      component mockups place the 390px mobile canvas and the desktop canvas
      side by side, as the shell does, and stack them from the stage's left
      edge below 760px.
- [x] Write the JavaScript authoring guides.

Evidence: `.context/rust-rebuild/delegation/m8-sidecar/report-1.md`
and `.context/rust-rebuild/sweeps/m8-sidecar.md`. Round 1 fixes and merge
decisions: `.context/rust-rebuild/delegation/m8-sidecar/report-2.md` and
`.context/rust-rebuild/delegation/m8-sidecar/merge-decisions.md`. Final part 1
fixes: `.context/rust-rebuild/delegation/m8-sidecar/report-3.md`.
Example and design catalogue port: `.context/rust-rebuild/m5-example/port.md`.
Frame inspector marker port and its Serve run: `.context/rust-rebuild/m7-inspector-run/log.md`.
Example and design catalogue render and visual check: `.context/rust-rebuild/example-visual/index.md`.
Design catalogue checks, their mutation proofs, and the packed consumer smoke: `.context/rust-rebuild/m5-example/design-checks/index.md`.
Review 3 fixes of the design checks and the smoke: `.context/rust-rebuild/m5-example/round8/index.md`.
Review 4 fixes, the built-site smoke, and its runs on the merged tree: `.context/rust-rebuild/m5-example/round9/index.md`.
The design links page split and the three packed smoke paths: `.context/rust-rebuild/m5-example/round10/index.md`.

Core integration evidence: `.context/rust-rebuild/delegation/m8-core/report-1.md`;
sweep: `.context/rust-rebuild/sweeps/m8-core.md`; merge decisions:
`.context/rust-rebuild/delegation/m8-core/merge-decisions.md`.
Core review fixes: `.context/rust-rebuild/delegation/m8-core/report-2.md`.
Final core review fixes: `.context/rust-rebuild/delegation/m8-core/report-3.md`.
Serve integration: `.context/rust-rebuild/delegation/m8-core/report-4.md`;
smoke artifacts: `.context/rust-rebuild/m8-serve-smoke/`.
Serve integration review fixes: `.context/rust-rebuild/delegation/m8-core/report-5.md`.
CSS integration review fixes: `.context/rust-rebuild/delegation/m8-core/report-7.md`.
Final core fixes and invocation-path smoke: `.context/rust-rebuild/delegation/m8-core/report-8.md`.

Browser case ownership: `.context/rust-rebuild/sweeps/m8-browser.md`.
Browser restoration checks: `.context/rust-rebuild/delegation/m8-browser/report-1.md`.
Copied comparison delivery and the shared Serve fixture: `.context/rust-rebuild/delegation/m8-browser/report-9.md`.
Browser merge decisions: `.context/rust-rebuild/delegation/m8-browser/merge-decisions.md`.
Browser review fixes: `.context/rust-rebuild/delegation/m8-browser/report-2.md`.
Final browser review fixes: `.context/rust-rebuild/delegation/m8-browser/report-3.md`.
Static and error-fixture follow-ups: `.context/rust-rebuild/delegation/m8-browser/report-4.md`.
Native copied comparisons and browser review 3: `.context/rust-rebuild/delegation/m8-browser/report-5.md`.
Browser review 4 and the comparison UI integration: `.context/rust-rebuild/delegation/m8-browser/report-6.md`.
Browser timing and review 5 fixes: `.context/rust-rebuild/delegation/m8-browser/report-7.md`.
Final comparison sweep integration: `.context/rust-rebuild/delegation/m8-browser/report-8.md`.
Prepared review 5 sweep inputs: `.context/rust-rebuild/delegation/m8-browser/round-7-sweep-input-checks.json`.
Design journey coverage: `.context/rust-rebuild/delegation/m8-browser/design-journey-map-round-3.md`.
Copied-static journeys: `.context/rust-rebuild/delegation/m8-browser/design-journey-map-round-4.md`.
Client shell specs and the sweep's viewer cases: `.context/rust-rebuild/delegation/m7/report-15.md`.
Client shell review 7 fixes, the merge of `c6e15729`, and the M8 viewer sweep
rows as generator inputs: `.context/rust-rebuild/delegation/m7/report-16.md`,
`.context/rust-rebuild/delegation/m7/merge-decisions.md` (Merge 7), and
`.context/rust-rebuild/delegation/m7/sweep-overrides-shell.json`.
Client shell review 8 fixes: `.context/rust-rebuild/delegation/m7/report-17.md`.
Callback review fixes and mock ownership checks:
`.context/rust-rebuild/delegation/m8-callback-fixes/report-1.md`.
The remaining client-shell cases of the sweep and their generator inputs:
`.context/rust-rebuild/delegation/m7/report-22.md` and
`.context/rust-rebuild/delegation/m7/sweep-overrides-shell-2.json`.
Review 11 fixes, the negative zero fix of live edit renders, and the merge of
the rebuild tip: `.context/rust-rebuild/delegation/m7/report-23.md`. Merge
decisions: `.context/rust-rebuild/delegation/m7/merge-decisions-round23.md`.

- [ ] Commit.

## Milestone 9: Changes

- [ ] Settle the Git changed-path input (user decision 45): the
      `review.changed-paths` row in `mokly-timings.md` describes Git discovery,
      but the span measures snapshot changed-entry collection. The comparison
      contract names Git changed paths as an input that production code does
      not read. Keep the span and the M12 tick pending the decision.

At completion Serve and the CLI classify changes against the Git base with
tree comparison, CSS attribution, and base-side rendering from Git. Serve emits review
v8 and snapshot v4; the viewer renders them after Milestone 10.

- [x] Index `Lookup` and build the projection's references on it, so one
      branch-point lookup serves every shell.
      Evidence: `.context/rust-rebuild/m9-lookup-and-matching/example-lookup-parity.json`
      and `branch-point-browser.log` there.
      Restart integration decisions: `.context/rust-rebuild/m9-lookup-and-matching/restart-merge/merge-decisions.md`.
- [x] Implement Git access in `mokly-git`: merge base, changed paths, bounded
      blob and tree reads, and archive extraction of a commit.
- [x] Add Git runner stdin and cancellation, SIGTERM then SIGKILL after
      one second, and drain process pipes before settling.
- [x] Add the part 1 base source reader, leased extraction cache, dependency
      input readers, three dependency tiers, and bounded install cache in
      `mokly-compare`, ready for the render graph connection.
- [x] Connect Serve's ordered `cancel_git` hook to active Git work. Add a
      real-process shutdown test for a Git process that ignores `SIGTERM`.
- [x] Implement base-side rendering: the base commit's Git tree as a source
      tree through the render graph, on-demand extraction of the base commit into
      a cache keyed by commit, the three dependency tiers of Decision 12 with
      the bounded install cache, scripts disabled, the time limit, the
      `base-dependencies` warning, and the terminal line that names the cache
      directory.
      Part 1 gap sweep: `/home/vercel-sandbox/mokly/.context/rust-rebuild/sweeps/m9-git.md`.
- [x] Apply final part 1 review fixes: sidecar repository roots, cache flush
      and trash handling, batched working hashes, independent tree bounds,
      rename encoding, warning locations, and concurrent cache misses.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/logs/m9-git/round3-targeted-tests.log`.
      Integration choices: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-git/merge-decisions.md`.
- [x] Milestone 9 part 2: implement `mokly-source-interface::SourceTree` over
      the commit-pinned Git index and batched blob reader. Cover projection,
      direct children, every mode, and typed IO errors.
- [x] Implement branch-point entry lookup and its shared verification cases:
      kind/case identity, accepted-pair precedence, removed destinations,
      counterparts, variant parents, stored titles, and generation isolation.
- [x] Project affected Usage links to their evidence entries through moves
      and removals, with kind isolation and distinct parent/variant destinations.
      Keep canonical impact grouping unchanged.
      Evidence: `.context/rust-rebuild/delegation/m8-browser/report-10.md`.
- [ ] Implement tree comparison in `mokly-compare`: ownership regions attached
      at composition,
      ignore regions, materiality on canonical trees, moves, documents, pages,
      affected consumers, and review result v8.
  - [x] Implement the HTML comparison engine, strict review v8 and snapshot v4
        readers, metadata, move pairing, and historical records.
  - [x] Resolve variant-only affected identity and actual-instance resource
        proof contracts before closing the engine.
- [ ] Implement CSS attribution in `mokly-css`: rule collection, diffing,
      selector matching with the keep list, own-page membership, the inline
      rule for whole-screen React entries, and a content-addressed parsed-CSS
      cache.
  - [x] Implement linked-rule collection, diffing, matching, catalogue-wide
        own-page proof, and a byte-bounded parse cache.
  - [x] Resolve multi-component selector ownership and inline evidence
        addresses. Connect page head styles.
  - [x] Connect sidecar style ownership through the base render provider.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round8/b-regression-final.log`.
  - [ ] Resolve user item 39 (review 6b finding 2): page-wide CSS-in-JS
        sheets are owned by the rendered parent in the code, so a child-only
        rule edit can create a direct parent change. Keep this behaviour until
        the user chooses the ownership rule.
  - [ ] Resolve user item 40 (review 6b finding 3): owned styles set material
        flags without per-rule records in the code. Consumer-instance matches
        of owned styles also supply implementation proof without those records.
        Keep the approved rule-evidence specification. Decide both evidence
        paths before adding records or changing the documented view-state rule.
- [x] Compute and retain HTML Changes in `mokly build`, with base selection,
      disabled Changes, invalid-base diagnostics, and terminal counts.
- [x] Apply comparison review round 1: exact instance proof, entry state and
      counts, strict failures, base warning scope, bounded resource reads,
      indexed attribution, move exclusions, and snapshot admission.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-2.md`.
- [x] Merge the renderer, viewer, and sidecar integration into the comparison
      branch after the first comparison review fixes.
      Merge decisions: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/merge-decisions.md`.
- [x] Apply final comparison review requests: inline own-page proof, input-owned
      slots, scoped Git metadata, streamed large-resource digests, planning
      batches, empty-base catalogues, and named limit diagnostics.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-3.md`.
- [x] Integrate the shared sidecar runtime into comparison: leased base sources,
      dependency tiers, one pool and cache, cancellation, typed diagnostics,
      and PostCSS source-directory isolation.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-4.md`.
      Merge decisions: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/merge-decisions.md`.
- [x] Isolate base JavaScript working-directory reads: sidecars run in the head
      repository, so `process.cwd()` reads in base code can read head files.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round8/a-regression-after.log`.
- [x] Apply shared-runtime review fixes: PostCSS child memory accounting, unique
      PostCSS contexts, base timeout recovery, streamed extraction, isolated
      test caches, and direct runtime regression tests.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-5.md`.
- [x] Integrate Changes with the static build pipeline for build and publish.
      Keep warning gates after comparison and retain the result for M12/M9.
      Merge decisions: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/merge-decisions.md`.
- [x] Add the Comparing phase spinner and measured durations to build Changes.
  - [x] Connect the Comparing spinner to the static phase reporter.
  - [x] Include the comparison duration when the Changes phase settles.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round8/d-duration-tests.log`.
- [x] Complete the final shared-runtime review: bounded memory sampling,
      canonical Node identity, ancestor dependency tiers, selected NODE_PATH
      priority, and direct base, extraction, timeout, and recycle tests.
      Evidence: accepted reviews `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/review-6a.md` and `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/review-7.md`.
- [x] Implement per-importer Node resolution on the base side (review 5b,
      finding 1 option A). Resolve each bare import from its matching directory
      in the dependency tier and retain tier-two missing-directory fallback.
      This follows the merge of the interim warning policy in report 7.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round8/e-importer-paths-after.log` and `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round8/e-native-tests.log`.
- [x] Apply the last integration requests: early base pinning, terminal ownership,
      nested CSS lookup, bounded memory tables, and recycle back-off.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-7.md`.
- [x] Integrate M11 with Changes: unify streaming digests, retain compiled
      recipes and epoch releases, preserve slot back-off and context affinity,
      and verify base-side parent-death cleanup with PostCSS child processes.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-7.md`.
- [x] Align the Rust review reader with viewer review 5, finding 10: current
      variants first, previous paths on moved pairs, and UTF-16 reason targets.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round8/c-regression-after.log`.
- [x] Apply the approved engine review 6 fixes: tracked dependency sources,
      bounded worker reuse by source root, cleanup consistency, directory
      variables, owned-style moves, trusted inline ownership, and phase formatting.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round9/repository-before-merge-result.json` and `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round9/sidecar-node-all-after-gate.log`.
- [x] Integrate the engine fixes with the iterative rebuild trees, preserving
      trusted style annotations through cloning, repair, equality, and cache accounting.
      Decisions: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/merge-decisions.md`.
- [x] Apply engine review 7 launch and test fixes: Windows path normalization,
      npm directory isolation, independent root-selection coverage, and restored
      rule-evidence wording. Record reserved names and owned follow-ups.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round10/targeted-results.json` and `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round10/pool-test-mutation-result.json`.
- [x] Merge the static Changes join into the engine branch. Keep owned-style
      comparison and shared projections together, isolate both reader test
      modules, and supply the duration fixture's base ref.
      Decisions: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/merge-decisions.md`.
- [x] Reduce source-root replacements in the shared Changes engine for build,
      publish, and Serve. Owner: M9 engine delegate (`m9-compare`). Render each
      side's planned views in one pass before pairing, or batch requests by root.
      Acceptance: one worker spawns a small constant per side switch plus
      recycles, independent of the number of paired views. Keep the pool bound.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round11/final-root-groups.json` and `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round11/comparison-equality.json`.
- [x] Settle base-render hardening under F8 decision 41 C. Retain the current
      environment filtering and reserved-path documentation without new rejection.
- [ ] Implement background classification in Serve, the change snapshot v4,
      and on-demand comparison snapshots and panes.
  - [x] Keep a selected variant nested under its component parent in review v8.
        Retain only that variant and capture only its documents. This preserves
        parent-owned dependency evidence instead of returning an invalid result.
        Decision: F5 option A, approved by the orchestrator on 2026-10-20.
        Evidence: `.context/f5/report.md`.
  - [x] Use the shared comparison projection for index, details, removed
        entries, workspaces, and generation routes in Serve.
        Merge decisions: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/serve-changes/merge-decisions.md` and `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/serve-changes/engine-merge-decisions.md`.
  - [x] Let event streams flush their final chunk before closing the other
        connections. Bound the grace period and require a clean stream end.
  - [x] Keep idle event-stream transport active with comments during background
        Changes. Preserve publication messages and clean shutdown.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/serve-changes/browser-setup-probe.log` and `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/serve-changes/sse-idle-after.log`.
  - [x] Record reused ready usage as completed, so a metadata-only rebuild
        publishes no extra usage revision.
        Serve lifecycle evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/serve-changes/independent-checks.md`.
  - [x] Measure interleaved head/base work in Serve background Changes and
        reduce source-root replacements within the configured pool bound,
        including the one-worker case. Integrate shared-engine batching with
        Serve-only interleaving (review 6a finding 2, option C).
    - [x] Group foreground sidecar calls before queued base calls. Prove
          one-worker and three-worker admission bounds and cancellation.
          Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/serve-changes/interleaving-measurement.md`.
    - Merge decisions: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/round-11/merge-decisions.md`.
    - [x] Release replaced base captures independently of cached delivery files.
          Keep the 60-second snapshot trim for duplicated delivery bytes, count
          the separate capture budget, and assert the real Serve capture trace.
          Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/report-11.md`.
    - [x] Repeat the combined measurement after shared-engine batching merges.
          Each run creates a fresh base runtime, bundle cache, and CSS context.
          Cached source and dependency reuse still publishes preparing. The
          one-line edit smoke took 5m19s to Changes ready with three sidecars.
          Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/round-8/cache-retention-measurement.md`.
          Quiet-machine repeat on 2026-10-19 at `a3cc0828`: eight default
          sidecars, base `4cc9e004`, default deadlines, 4 GB stop, 50 ms PSS
          samples with per-process RSS fallback. The authorized incomplete
          render returned 100 Continue before the edit and 400 after release.
          Edit to ready: 127.955 s. Initial peak: 2.615 GB. Held reclassification
          and new-capture-to-release peaks: 2.054 GB. Initial/replacement
          sidecar starts: 14/12; source-root groups: 3/2. Machine: eight CPUs,
          16.25 GiB RAM, Node 24.21.0, Rust 1.95.0 development build.
          Evidence: `.context/m14-measurements/m9-default/summary.json`.
      - [x] Measure one worker with an old capture held by an in-flight request.
            The default-count probe stops at the common memory allowance before
            ready; its edit time and overlap peak need a probe-budget decision.
            Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/round-11/measurements.md`.
            Measurement clarification: the held-phase peak precedes the new
            capture, so it only bounds the overlap window. Its maximum cannot
            be recovered from the saved phase maxima. The initial phase peaked
            at 1,603,197,952 bytes.
      - [x] Run the deferred default-count probe with a 4 GB allowance in a
            quiet machine window, with no other delegate running, alongside
            the M14 React Serve measurement. Decision C, approved by the
            orchestrator on 2026-10-19: the shared-machine 2 GB rule stays.
            Record the maximum from the new capture's start to the old
            snapshot's release.
            Completed by the measurement workspace on 2026-10-19. Evidence:
            `.context/m14-measurements/m9-default/summary.json`.
    - [x] Use an intentionally unresolved base for the shared browser example,
          with terminal quiescence and one Git diagnostic. Real Changes specs
          keep independent fixtures. Keep the 600-second guard and one sidecar.
          Decision: review 5 finding 1B, approved in changes-6.md.
  - [x] Install classification metadata after ready projection, so projection
        cannot consume a new generation's retention window before publication.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/serve-changes/metadata-install-before.log` and `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/serve-changes/metadata-server-tests.log`.
  - [x] Keep advertised classification JSON within the existing byte and count
        bounds. Expire idle snapshots and recapture removed previews and
        component views. Retry a full-store metadata installation.
        Decision: review 5 finding 2C, approved in changes-6.md.
        Serve report and sweep: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/report-7.md` and `/home/vercel-sandbox/mokly/.context/rust-rebuild/sweeps/m9-serve-changes.md`.
  - [x] Apply Serve Changes review 5: merge-base polling, process readiness,
        single capture diagnostics, advertised component requests, trace
        parents, shared removed workspaces, and Git admission and drain tests.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/report-8.md`.
  - [x] Apply the final Serve Changes review: shared example base, exact retry
        timing, cancellation and size failure, capacity before projection,
        trace outcomes, backward tip moves, and advertised URL fences.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/report-9.md`.
- [ ] Behaviour tests from the captured scenarios, rewritten in the new
      formats; run the gap sweep against the Changes and attribution
      contracts.
  - [x] Add the index v7/detail v1/review v8 adapter and HTML behavior fixtures.
  - [x] Run the bounded previous-contract and test-title sweep.
        Part 2 sweep: `/home/vercel-sandbox/mokly/.context/rust-rebuild/sweeps/m9-compare.md`.
  - [x] Replay the eleven full references after the sidecar and source
        migration are ready. Every captured catalogue has JavaScript entries.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/sweeps/m9-references.md`.
  - [x] Align variant metadata with the parent rules: schema, controls, and
        declared slots belong to the parent. Keep independent variant metadata,
        props, and supplied slots. Rerun move and removal with 24 and 25 Changes.
        Decision: R15-D1 option A, approved as spec alignment in changes-12.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/sweeps/m9-references.md`.
  - [x] Check cancellation between bounded base-capture views. Return the
        generation's cancellation error before a later view is read or encoded.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round15/cancellation-after.log`.
  - [x] Bind Serve base workers to the classification token, including cached
        captures. Verify that replacing a run cancels its prepared base graph
        while the command and current workers remain active.
        Evidence: `.context/rust-rebuild/m9-round16a/` and
        `.context/rust-rebuild/delegation/m9-compare/report-16a.md`.
        Merge decisions: `.context/rust-rebuild/delegation/m9-compare/merge-decisions-15.md`.
- [ ] Port the deferred native Changes browser fixtures in the M8 browser
      sweep: base references, moved/removed entries, comparison requests and
      renewal, and CSS evidence. M9 supplies the fixtures; M10 owns their UI
      assertions. Keep the duplicate component-explorer cases in one suite.
  - [x] Add one native HTML fixture with five cases in four Serve Changes specs.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/serve-changes/engine-native-browser.log`.
  - [x] Supply a shared private Serve comparison fixture with a pinned base,
        moved and removed entries, CSS evidence, watched edits, and base-ref
        moves. Cover readiness, membership, retained bytes, and renewal.
        Evidence: `.context/rust-rebuild/delegation/m8-browser/report-9.md`.
  - [ ] Complete the 174-case M9/M10 port in `sweeps/m8-browser.md` and
        `next-assignments.md` item 7b.
        Cold base-source preparation uses real offline builds in
        `tests/static_cold_base_tiers.test.ts` for all three dependency tiers.
        Evidence: `.context/cold-base-tiers/inventory.md` and `.context/cold-base-tiers/`.
- [ ] Add the stylesheet attribution tests over the design catalogue that
      `mokly-component-design.md` and `mokly-design-component-attribution.md`
      define: the nine shared sheets per scenario, the pinned rendered
      stylesheet links, the exact per-entry rendered-resource and rule
      records, the exact changed-entry union, no affected consumers for
      unresolved shared rules, and the attribution acceptance matrix.
      The matrix runs on demand until its CI job is decided.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-11.md`.
  - [ ] Decide the CI home of the on-demand design matrix (review 8 finding
        1B, user decision 50). Add no CI job or timeout change before that decision.
- [x] Apply engine review 8 fixes: gate the design matrix for on-demand runs;
      bound base capture to 256 MiB and retain cached head reads;
      preserve deep props and private trusted records; cover capture timings,
      generated assets, fallback bytes, engine scale, and preview Reset.
      Merge the iterative-tree rebuild tip and verify identical example output.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-12.md` and `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-13.md`.
- [x] Apply engine review 9 and merge the rebuild tip.
  - [x] Clarify capture budgets, reuse, wrapper checks, and stage counters;
        test rebuilding a capture with a smaller bound.
  - [x] Align removed and selected preview protocols with bounded capture.
  - [x] Keep pending design-matrix CI decisions out of end-state docs.
  - [x] Cover partial capture, typed decode failures, and zero-view timings.
  - [x] Count uncaptured base views without changing capture charges.
  - [x] Merge the rebuild tip and run the required checks and example parity.
  - [x] Integrate Serve Changes after the restart. Keep digest checks around
        capture creation and preserve advertised historical generation URLs.
        Compile the on-demand matrix without executing it.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-14.md`.
- [x] Keep a view that exists on one side out of implementation impact when
      its entry has both sides; adding Dark to a light-only catalogue made
      every build and Serve classification invalid.
- [x] Close the large-fixture Changes reference gap: the old captures have
      no Changes result or rule evidence, and all four catalogue captures
      are byte-identical. Use the stylesheet-edit reference for CSS evidence;
      prove large-scale Changes with the Rust implementation.
  - [x] Prove bounded full-comparison work at 128 and 512 component parents
        with variants, and shared before/after CSS parse reuse.
  - [x] Complete reviews, resource inventories, and closures for the two
        distinct large states: the unrelated-rule edit and the watch edits.
        Use one sidecar, a detached run, an external 60-minute guard, and the
        same 1.85 GB process-family PSS bound. The earlier external ten-minute
        guards stopped base rendering before capture started; they are not
        product limits. Three earlier states have identical source trees.
        Before each run, record its exact expected Changes and rule evidence.
        The unrelated-rule edit must list no Changes and retain `no-selector-hit`
        exclusions on views that link `shared-1.css`. Classify every differing
        field in both completed results before accepting the artifacts.
        Evidence: `.context/rust-rebuild/sweeps/m9-references.md`.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-17.md`.
        Completed evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-19.md`.
- [ ] Commit.

## Milestone 10: Viewer reads review v8 and snapshot v4

Tags: ui

- [x] Update the viewer's review and snapshot readers to the generated types;
      comparison panes and Changes presentation do not change.
- [x] Check the shell's projection of the entry detail's review v8 rule and
      resource records (`packages/viewer/src/review/view_evidence.ts`)
      against Milestone 9 output.
- [x] Align the viewer's `historicalSnapshotId` with the snapshot identity of
      the serialization contract: `sourceKind` is the literal `base`.
- [x] Trim `@mokly/viewer/data` to the surface that `mokly-viewer.md` and the
      package README describe (the path functions, the directory names, the
      path grammar, and the prop schema validators) when review v8 replaces
      the review v7 and manifest types that it still exports.
- [x] Add user-facing wording for the review v8 `implementation` reason under
      the `product-ui` rules. Explain actual-instance component impact while
      preserving the component's own view states.
- [ ] Run the viewer suite against Milestone 9 output.
  - [x] Run the comparison UI in Chrome against `mokly build --base` output
        and a removed-entry fixture, and fix the viewer defects that it finds.
  - [x] Settle how Details shows the review reasons, including
        `implementation`, before a comparison loads (report 18, decision D1).
    - [x] D1 spec correction, backend: carry `reasons` in the review v8 shape at the
          detail root for ready included current and removed entries, independent
          of workspace readiness. Share the projection across static output and
          Serve, clear stale reasons, and generate the additive v1 field.
          Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/report-10.md`.
    - [x] Apply review 7: define page and document reasons, check detail reasons
          against ready included membership, and use UTF-16 source reason order.
          The orchestrator confirms that changed deployment identities are required.
          Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/report-11.md`.
    - [x] D1 viewer: read `reasons` strictly with their shape and order; show
          them in Details for a listed record before a comparison loads, once
          beside a loaded comparison; state the sentence of each reason kind,
          including `implementation`, in `mokly-component-workspace-design.md`.
          Whether a reader also rejects a detail whose reasons disagree with
          its index record waits for the round's decision.
    - [x] Keep Details graceful: the viewer rejects no detail whose reasons
          disagree with its index record, so details written before reasons
          keep loading, and drops a reason that contradicts its record
          instead. Test every reason sentence and a removed snapshot.
          Decisions 6 A, 1 B, and 2 A of the D1 round, approved by the
          orchestrator on 2026-10-19.
    - [x] Depict one sentence per reason with the protocol copy in the
          component explorer and removed-screen designs. The `style-changed`
          fixture of Action's parent carries the `implementation` reason,
          because every other changed comparison fixture routes a variant.
          Decision 4 A, approved by the orchestrator on 2026-10-19.
    - Pages, documents, and use cases show no reason sentences until a
      design exists. Decision 7 A, approved by the orchestrator on
      2026-10-19.
    - [x] Keep the viewer and the designs consistent: every Browse design of
          a changed, added, or removed screen reads its reason sentences;
          Details show the reasons first, in the designs' order; a `screen`
          reason has no sentence; every pane frame attribute is checked in
          each host; and the panes page states where its proofs run, with
          Serve proving presentation and renewal only. Round 3 items of the
          D1 delegate, given by the orchestrator on 2026-10-20.
    - Batch 8 integration keeps the shared Serve alignment, input, and
      Scroll together cases. The pane attribute checks also run on Serve.
      The live coverage docs include these retained proofs.
    - The browser test guide stays one page past 300 lines. Decision 2 A of
      the D1 round 2 report, approved by the orchestrator on 2026-10-20.
- [x] Complete the M8 browser sweep's comparison UI cases against review v8
      and snapshot v4, including filter disclosure, Changed membership,
      comparison scroll regions, retained focus, and stylesheet Details.
  - [x] Port the cases that the shared copied comparison output supports,
        with the fixture entries that they need.
  - [x] Port the last rows: whole-page, component, and outside stylesheet
        Details with their approved designs, the React evidence copy, the
        removed page's history, and the branch-point cases through Serve and
        the embedded viewer. Round 4 of the D1 delegate, given by the
        orchestrator on 2026-10-20.
    - The branch-point rows run on the branch-point fixtures, not on the
      example catalogue built with a base, whose build takes about 175
      seconds. Decision 12 A of the round 4 report, applied as the default.
  - [x] Port the cases that need Serve comparisons, after the M9 TODO for
        background classification and on-demand comparisons in Serve.
  - [x] Port the moved-entry cases with the shared moved fixtures in the
        branch-point copy and `serve_comparison_test.ts`.
  - [x] Port the two D1 cases, Details before a comparison loads and the
        `implementation` reason, after the backend and viewer D1 tasks.
  - The M10 D1 delegate owns the branch-point comparison UI and the
    light-only document rows. Decision 8 A, approved by the orchestrator on
    2026-10-19.
  - [x] Port the cases that need an embedded viewer host through both frame
        adapters; `sweep-overrides-comparisons.json` and
        `sweep-overrides-comparisons-3.json` in
        `.context/rust-rebuild/delegation/m7/` name each row.
  - [x] Register the moved-entry viewer cases on the embedded viewer host
        through both frame adapters, over the branch copy. The case that
        follows the page address runs only on Serve and the branch copy.
  - [x] Port the two Serve rows that the regenerated sweep left, given by the
        orchestrator on 2026-10-20. `review.spec.ts:4 [live refresh]`: a
        refresh after a failed comparison and its retry presents new
        snapshots on Serve (`d7f4fb79`). `moved_viewer.spec.ts:5` needs no
        new test: the old viewer host never registered the first-paint case,
        and the case at that index already runs on the embedded viewer.
  - [x] When `rebuild/m10-d1-and-copies` merges, make its copied-output
        `light_only_document_band.spec.ts` and `imported_css_comparison.spec.ts`
        call `light_only_band.ts` and `imported_css_panes.ts`, which the Serve
        instances use, so each check lives once.
- [x] Make the viewer follow the settled design copy and states of the design
      catalogue (version failure, controls copy and states, loading states).
      Source: the design entries `design/browse/loading/**` and
      `design/components/controls/**`,
      `examples/basic/specs/design/components/controls/parts/copy.ts`, and
      `mokly-viewer-namespace.md`, `mokly-viewer.md`,
      `mokly-shell-delivery.md`, and `mokly-component-controls-design.md`. The
      copy tables in `.context/rust-rebuild/delegation/m5-example/report-2.md`
      and `report-3.md` there list the differences from the viewer.

Settled copy and states with their Serve run: `.context/rust-rebuild/m10-copy-run/log.md`.
Review fixes of the copy and states with their Serve run:
`.context/rust-rebuild/m10-copy-run-2/log.md`.
Final review fixes and their check logs:
`.context/rust-rebuild/delegation/m7/report-9.md`.
The 409 index refresh, the mobile pending pill, and the frame sandbox message:
`.context/rust-rebuild/delegation/m7/report-10.md`.
The review v8 reader, the base snapshot identity, the `./data` trim, the
`implementation` wording, and the projection check against Milestone 9 output:
`.context/rust-rebuild/delegation/m7/report-11.md`.
The Chrome run against Milestone 9 output, its viewer fixes, and decision D1:
`.context/rust-rebuild/delegation/m7/report-18.md`.
The comparison UI specs on the shared copied comparison output, the fixture
entries, the removed-variant heading fix, and the sweep inputs:
`.context/rust-rebuild/delegation/m7/report-19.md`.
The review 9 fixes, the specs under their documented names, the sweep reasons
and drops, and the merge of the rebuild tip:
`.context/rust-rebuild/delegation/m7/report-20.md`. Merge decisions:
`.context/rust-rebuild/delegation/m7/merge-decisions-round20.md`.
The review 10 fixes (the held-request waits, the Before-only canvas, and the
embedded host sub-TODO), the sweep halves and part rows, and the merge of the
rebuild tip `fa06c3fd`: `.context/rust-rebuild/delegation/m7/report-21.md`.
Merge decisions:
`.context/rust-rebuild/delegation/m7/merge-decisions-round21.md`.
The round 24 rows on the shared copied comparison output, the new fixture
entries, the sweep inputs, and the rows that remain:
`.context/rust-rebuild/delegation/m7/report-24.md`.
The round 25 embedded viewer host and its rows, the document, shared impact,
and scroll fixture groups, the review 12 fixes, the sweep inputs, and the rows
that remain: `.context/rust-rebuild/delegation/m7/report-25.md`. Merge
decisions for the rebuild tip `a3cc0828`:
`.context/rust-rebuild/delegation/m7/merge-decisions-round25.md`.
The D1 viewer reasons, the two D1 rows and the `implementation` case, the
light-only document, imported CSS, HEAD-baseline, and branch-point rows on
small comparison copies, the round 25 follow-ups with the component light-only
note fix, the sweep inputs, and the merge decisions for the rebuild tip
`ef7458f2` and the delivery fixtures `f4829d8d`:
`.context/rust-rebuild/delegation/m10-d1/report-1.md`.
The D1 round 2 decisions (1 B, 2 A, 3 B, 4 A, 5 A), the reason sentences in
the designs, the comparison suites list in the browser test guide, and the
merge of the rebuild tip `3d2d1535`:
`.context/rust-rebuild/delegation/m10-d1/report-2.md`.
The D1 round 3 viewer consistency items, decision 2 A, and the merge of round
2 at `659eb918` onto the rebuild tip `d857b6cf`:
`.context/rust-rebuild/delegation/m10-d1/report-3.md`.
The D1 round 4 rows, their fixture entries, the branch-point hosts, the
example build measurement, and the sweep inputs:
`.context/rust-rebuild/delegation/m10-d1/report-4.md`.
The F10 follow-ups of round 4, the merge of the rebuild tip `453eef9b`,
and the sweep renames: `.context/rust-rebuild/delegation/m10-d1/report-f10.md`.

- [ ] Commit.

## Milestone 10.1: Decision defaults in the designs

Tags: mockup

- [x] Item 32 A: depict an unchanged screen that a changed component affects,
      reached from that component's Affected screens, with its Details
      explanation: `design/components/states/shared-impact/affected-screen`.
      The shell offers no comparison for such a screen, so no artboard draws
      its pane heading; the open decision on affected-only comparisons under
      the final review TODO owns that depiction.
- [x] Item 25 B: draw the desktop component canvas at the fixed 1024px layout
      width, and state it in the component design.
- [x] Item 35 A: confirm that the design catalogue depicts the
      `implementation` sentence. Already done:
      `design/components/states/shared-impact/style-changed` reads it, and
      the component workspace design and the viewer use the same sentence.
- [x] Run the mockup check and smoke-test the changed pages through Serve.
      Evidence: `.context/defaults-viewer/` (mockup check logs and shots).

## Milestone 10.2: Decision defaults in the viewer

Tags: ui

- [x] Item 42 A: show the design catalogue's missing-pane copy.
- [x] Item 38 C: apply the style-only heading rule of any rule status.
- [x] Item 32 A: explain affected-only entries in Details and their
      comparison pane heading; fix the records sentence.
- [x] Item 24 A: show each use-case step's mobile view in a phone frame below
      760px.
- [x] Item 17 A: lay out the prop controls as rows with a label column. The
      settled copy and states were already in the viewer.
- [x] Decision 34 A: delete the dead `ShellContext.componentChanges` path and
      move the copy checks that reached Details through it to live inputs.
- [ ] Pass the complete gate on the final commit, push the branch, and report.

## Milestone 11: Watch and incremental rendering

- [x] Reuse unchanged encoded details across watched generation rebuilds
      (Milestone 6 review 2, finding 1C).

- [x] Tie Serve's watching copy to the active watcher and cover its terminal
      output (Milestone 6 review, finding 10).
- [x] Implement the content-addressed render graph: inputs hashed per entry,
      invalidation from the sidecar's module graph, HTML component
      dependencies, stylesheet dependencies, and PostCSS reports.
- [x] Implement the watcher with the denial rules, rebuild on change, bundle
      replay for HTML-only edits, and live updates to the viewer through the
      index and entry detail routes under one revision, with frames reloaded
      by document key and no page reload.
- [x] Release PostCSS contexts and replaced sidecar generations when the last
      graph that uses them drops. Design ownership with Serve revision fences,
      cancelled requests, and watch replacement; prevent an old graph from
      using new bindings or class maps under an old fragment key (M8 review 1,
      finding 8).
- [x] Behaviour tests that count rebuilds and renders per change.
- [x] Port the M8 browser sweep's watch and folder-update cases after watcher
      integration. Use publication events and document keys in place of page
      reloads. Keep shutdown, moves, titles, search, and disclosure coverage.
      Evidence: m12-static report-14 and sweep-overrides-watch.json (orchestrator records).
- [x] Preserve saved component frame document keys when controls supply view
      records. Only temporary preview URLs bypass the saved document key.
- [x] Bound retained stylesheet results and keep generation source snapshots
      valid after cache eviction.
- [x] Keep explicit watch rules subject to directory denials.
- [x] Observe confined ancestors and recover required inputs after a parent
      directory moves or is replaced.
- [x] Sweep the previous watch and runtime rules and test cases at `0bbd737e`.
- [x] Smoke-test HTML, CSS, and React edits through the shim in Chrome.
- [x] Verify generated types and pass the complete gate.
- [x] Commit.

Evidence: `.context/rust-rebuild/delegation/m11/report-1.md`,
`.context/rust-rebuild/m11-smoke/`, and `.context/rust-rebuild/sweeps/m11.md`.

- [x] Verify that watching prunes build outputs and reservation paths by path,
      without ownership-marker parsing.

- [ ] After the first hosted macOS and Windows runs, make event loss recoverable
      there: choose a repository-root rescan after each macOS batch and an
      exact-input stamp check on Windows, or one recursive watch per root on both
      systems; tests.
- [x] Report the composition warnings of every Serve attempt once, including
      on-demand and background renders, through an attempt-scoped sink with a
      seen set kept across a failed attempt (`mokly-build-warnings.md`).

Evidence: `.context/rust-rebuild/delegation/m11/report-4.md` and
`.context/rust-rebuild/sweeps/m11-warnings.md`.

- [x] Correct Serve warning review findings 1 to 7 and flush the current
      attempt's pending warnings on fatal server failure.

Evidence: `.context/rust-rebuild/delegation/m11/report-5.md` and
`.context/rust-rebuild/delegation/m11/merge-decisions.md`.

- [x] Merge comparison-engine updates, apply one cancellation rule to fatal
      Serve warnings, and prove destination composition.

Evidence: `.context/rust-rebuild/delegation/m11/report-6.md` and
`.context/rust-rebuild/delegation/m11/merge-decisions.md`.

## Milestone 11.1: Watch review corrections

- [x] Merge rebuild updates through `09821954` and preserve both branches.
- [x] Order Serve shutdown and reject changes to running pool settings.
- [x] Batch native watches, normalize platform events, recover event loss,
      and extend exact inputs without replacing root observers.
- [x] Queue resource attachment, close adoption races, and retry failed
      attempts when newly authored inputs are repaired.
- [x] Match watched failure layout, bound debounce conversion, and separate
      filesystem edits from manual rebuild tests.
- [x] Release pool epochs and PostCSS contexts without blocking graph drops.
      Give each PostCSS context one worker and release idle workers promptly.
- [x] Retain compiled code for old-generation replay and reuse compilations
      when only evaluation settings change.
- [x] Memoize digest-only reads without retaining bytes, check resource
      confinement, and cover React and Storybook metadata in bundle reuse.
- [x] Verify operation counts, failed JavaScript candidates, manual rebuilds,
      detail usage reuse, watcher bursts, and lifecycle races.
- [x] Update the watch sweep and specifications. Keep bundle-level CSS
      invalidation while the user considers review 1b-6.
- [x] Pass the complete gate, regenerate types without drift, and repeat the
      Chrome edit smoke without the sidecar timeout override.
- [x] Commit and write the final round 2 report.

Evidence: `.context/rust-rebuild/delegation/m11/merge-decisions.md` and
`.context/rust-rebuild/delegation/m11/report-2.md`.

## Milestone 11.2: Final watch corrections

- [x] Merge static output, release, viewer recovery, and HTML sweep changes.
- [x] Correct native registration recovery, event mapping, and negative debounce.
- [x] Use one startup and serving lifecycle and prove process shutdown order.
- [x] Keep sidecars inside their binary lifetime with parent-death protection.
- [x] Restore shared compilation across slots and recycling, bound recipes,
      retain failed peer resolution, and hash resolution metadata and membership.
- [x] Fix pool scheduling, cleanup notices, and per-path digest concurrency.
- [x] Cover two-sidecar operations, manual rebuild counts, and watcher targets.
- [x] Align diagnostics, lifecycle docs, and the gap sweep. Record deferred work.
- [x] Pass the repository suite, affected tests, type generation, and the
      two-sidecar Chrome smoke without a timeout override.
- [x] Check the complete-gate disk condition and record the merge-time gate
      when less than 15 GB is free.
- [x] Commit and write the final round 3 report.

Evidence: `.context/rust-rebuild/delegation/m11/report-3.md` and
`.context/rust-rebuild/delegation/m11/merge-decisions.md`.

## Milestone 12: Static build and publish

- [x] Apply the final comparison join requests: viewer eligibility in both readers,
      shared removed records and details, ready raw-byte preservation, and merged checks.
      Evidence: `.context/rust-rebuild/delegation/m12-static/report-8.md`.

- [x] Apply comparison join review 4: shared projection, view membership, private
      snapshot contract, branch tests, indexed workspaces, timings, and merged verification.
- [x] Complete timing records for dependency `tier`, comparison view counts, and
      `review.changed-paths` in the shared Changes pipeline (review 4, finding 7).
- [x] Apply publication review 6 findings 2 and 3: accurate missing-set evidence,
      complete cleanup after receiver failures, child cancellation, and explicit
      unavailable-output checks. Keep the publish warning decision open.

- [x] Implement the static output of `mokly build` in `mokly-static`: one
      stub per shell route, the catalogue index, the entry details, the
      documents, the comparison generation, the shared `mokly-model` ownership
      marker writer, the `--out` option with its default `mokly-static/` output
      directory, and the transaction with backup, exclusive rename, and rollback.
  - [x] Write deterministic current output, head-only inspector metadata,
        canonical index and details, exact package assets, and shared ownership.
        Implement reservations, exclusive installation, rollback, bounded cleanup,
        input rechecks, and config-relative output selection.
  - [x] Join the Milestone 9 comparison generation, removed records, and detail
        evidence before identity finalization. Repeat the comparison-specific
        reference scenarios after that integration. The join must populate upload
        `baseRef` instead of null.
        Nest build review spans under `output.write` with the caller context.
        Repeat the Changes-enabled build-directory entry delivery cases;
        their current-only acceptance is complete.
  - [x] Add subprocess recovery tests through a test-only fault seam for rollback,
        backup cleanup, cancellation plus cleanup, and cleanup-only failure.
        Include process-level configuration and staging signal faults.
        The recovery page stays in progress for the M9 stages and the open
        forced-exit decision recorded under review.
  - [x] Add an independent reader of the installed ownership and upload fixtures.
        Keep ownership, upload exchange, and validation Status lines until this
        reader and the M9 comparison join are verified.
  - [x] Complete the sweep rows owned by M12 static, transaction, and static
        closure acceptance. Add the remaining exact destination races,
        reservation mutations, Unicode/NUL rename paths, imported resources,
        private templates, host-normalized paths, abandoned lock retention,
        and signal-handler release cases named in the sweep.
- [x] Implement publish, which builds into its own directory first, through
      the unchanged exchange v1: plan, blobs,
      complete, retries, accounting, the clean-checkout and uncommitted
      changes rules, and the upload validation fixtures.
  - [x] Implement the `mokly-publish` exchange client with immutable output
        snapshots, metadata v2, ownership v3, bounded HTTP, retries, expiry,
        one re-plan, digest accounting, and public fixture tests.
  - [x] Add clean-checkout checks, cancellable Git calls, the static-output
        trait, and the pre-build private-directory line. Keep completed
        output after upload failure.
  - [x] Connect `mokly-static` to the CLI-owned publish adapter and its rich
        terminal phases. Both crates use the shared output shapes and marker
        writer in `mokly-model`. Verify real rendering, transaction cancellation,
        and deployment identity. Cover spawned SIGINT/retry uploads, rich phase
        transitions, source changes, and the deferred gap-sweep scenarios.
    - [x] Complete the sweep rows owned by M12 publication acceptance: assigned
          credentials, checkout variants, interrupted
          compiler diagnostics, rich summary styling, and every retry status
          through the real process.
    - [x] Move `Directory`, `DirectoryFailure`, `StaticUnavailable`,
          `BuildWarnings`, `Build`, `Uncommitted`, and `HeadChanged` from
          `mokly-publish` into the CLI publication error contract when the
          static adapter lands.
- [x] Add the `git-uncommitted` detail layout and avoid repeated detail and
      recovery-hint sentences in terminal errors.

Publish client gap sweep: `.context/rust-rebuild/sweeps/m12-publish.md`.
Publish client review fixes and TLS checks:
`.context/rust-rebuild/delegation/m12-publish/report-2.md`.
Publish client final review and merge decisions:
`.context/rust-rebuild/delegation/m12-publish/report-3.md` and
`.context/rust-rebuild/delegation/m12-publish/merge-decisions.md`.

- [x] Restore the preview deployment workflow on the new CLI.
- [x] Write the build and publish guides.

Static output evidence: `.context/rust-rebuild/delegation/m12-static/report-1.md`,
`.context/rust-rebuild/m12-smoke/`, and `.context/rust-rebuild/sweeps/m12-static.md`.
Round 1 fixes and merge decisions: `.context/rust-rebuild/delegation/m12-static/report-2.md`
and `.context/rust-rebuild/delegation/m12-static/merge-decisions.md`.
Last fix round: `.context/rust-rebuild/delegation/m12-static/report-3.md`.
Non-comparison M12 acceptance: `.context/rust-rebuild/delegation/m12-static/report-4.md`
and `.context/rust-rebuild/sweeps/m12-static.md`.
Final acceptance fixes: `.context/rust-rebuild/delegation/m12-static/report-5.md`.
Comparison join and static browser acceptance: `.context/rust-rebuild/delegation/m12-static/report-6.md`.
Comparison join review 4: `.context/rust-rebuild/delegation/m12-static/report-7.md`.
Publication adapter acceptance: `.context/rust-rebuild/delegation/m12-static/report-9.md`.
Publication review and timing acceptance: `.context/rust-rebuild/delegation/m12-static/report-10.md`.

- [x] Commit.

## Milestone 13: Release packaging

- [ ] Add pnpm and Yarn base dependency installation before the first release,
      under F8 decision 10 option B. Keep the current npm-only limit documented
      until that support is implemented and verified.

- [x] Build and pack the viewer before the CLI authoring declarations and
      CLI `prepack`; verify this order in clean package consumers.
- [x] Add the release build matrix for the five targets, the package set
      (viewer, five platform packages, CLI), the registry guards, and the
      publish order.
  - [x] Restore paired tags, native archive inspection, all package manifests,
        registry guards, and native/viewer/CLI publication ordering.
  - [x] Add Linux x64, Linux ARM64, macOS ARM64, and Windows x64 jobs.
  - [x] Settle the Intel macOS runner-policy exception and add its matrix row.
- [x] Update Release Please for the package set and write the breaking-change
      release note for the first 0.x release of the new core.
- [x] Make Release Please update the exact `@mokly/viewer` pin in
      `packages/mokly/package.json` with the viewer release. Test the manifest
      and lockfile updates together.
- [x] Verify that Release Please preserves the private root native `file:`
      links and keeps the public CLI native versions coordinated. The binary
      embeds the CLI package version at build time.
- [ ] Verify native TLS on macOS and Windows CI. Build all five target
      binaries with a target C toolchain and check `ldd`, `otool -L`, or
      `dumpbin /dependents` for an unintended crypto shared-library dependency.
- [x] Reconnect the Node agreement and profile-selector tests to the shim's
      gate and tested versions; compare Testbox with the native CI runtime.
- [ ] Dry-run the release scripts locally; the real publication is post-merge.
  - [x] Run the local steps that need no credentials or registry write against
        a scratch checkout and record the blocked steps.
  - [ ] Complete the seven-package pack, reuse, and smoke with all native
        archives from the hosted target builds.
- [ ] Settle Release Please selection for core-only commits under the
      Milestone 15 review decision.
- [x] Run the installed static output and Serve smoke after their integration.
  - [x] Run installed Serve with the tiny HTML catalogue.
  - [x] Run installed static output after Milestone 12 supplies the writer.
  - [x] Make `npm run package:smoke` require the built site once Milestone 12
        supplies the writer.
- [x] Cover the three paths of the previous packed smoke: zero-install
      `npx --package @mokly/mokly mokly` with an empty cache, configuration
      discovery from a nested directory, and a document page through the
      installed CLI.
- [x] Integrate the Milestone 8 part 2 npm-version fix before release checks
      can pass; the bumped-copy sidecar tests and version-path regression stay
      required.
- [x] Commit.

Release package evidence: `.context/rust-rebuild/delegation/m13/report-1.md`.
Release gap sweep: `.context/rust-rebuild/sweeps/m13-release.md`.
Release review and merge decisions: `.context/rust-rebuild/delegation/m13/report-2.md`
and `.context/rust-rebuild/delegation/m13/merge-decisions.md`.
Final release review fixes: `.context/rust-rebuild/delegation/m13/report-3.md`.
Release integration: `.context/rust-rebuild/delegation/m13/report-4.md` and
`.context/rust-rebuild/delegation/m13/merge-decisions.md`.
Static release verification and smoke scope comparison:
`.context/rust-rebuild/delegation/m13/report-5.md`.
Packed example smoke with the built site on the merged tree:
`.context/rust-rebuild/m5-example/round9/package-smoke.log`; it fails when the
site is absent: `.context/rust-rebuild/m5-example/round9/package-smoke-no-site.log`.
Packed example smoke with zero-install npx, nested configuration discovery,
and a document page: `.context/rust-rebuild/m5-example/round10/package-smoke-1.log`;
its mutation runs: `.context/rust-rebuild/m5-example/round10/mutations/`.

## Milestone 14: Large-project acceptance

- [x] Apply M12 review 9 findings 1, 3, and 4: retain the original timing
      writer, clarify drain and recycle scope, and distinguish the exit and
      drain receivers in the mocked shutdown test.
      Evidence: `.context/rust-rebuild/delegation/m12-static/report-13.md`.

- [x] Apply M12 review 8: bound graceful stderr drain, move the large Serve
      stream before shutdown, clarify replacement timing, redact forwarded
      records, separate partial stderr lines, and test UTF-8 and dependency errors.
      Evidence: `.context/rust-rebuild/delegation/m12-static/report-12.md`.
- [x] Measure the old process's stop inside replacement timing after defining
      span ownership across separate stop and spawn requests (M12 review 8,
      finding 3B; changes-9 authorizes the documented 3A fallback for this round).
      Approved option A on 2026-10-19 keeps each stop and spawn under its own caller.
      Evidence: M14 sidecar stop timing final report, `.context/m14-stop/report.md`.

- [x] Include partial factory startup cleanup in stop timing without changing
      lifecycle calls or errors. Apply stop-timing review finding 1, option B.
      Evidence: `.context/m14-stop/review.md` and `.context/m14-stop/report.md`.

- [x] Apply M12 review 7 findings 2 to 6: count-record exclusivity, dependency
      span scope and tier tests, portable cache fixtures, and receiver cleanup.
      Evidence: `.context/rust-rebuild/delegation/m12-static/report-11.md`.

- [x] Stop sidecar and PostCSS children quietly on a closed parent output pipe.
      Verify response, operation-count, diagnostic, and IPC closure without sleeps.
      Evidence: `.context/rust-rebuild/delegation/m12-static/part0-done.md`.

- [ ] Obtain user approval for the current 2 GiB per repository cache namespace
      and the shared 120-second dependency preparation allowance before adding
      these values to the timings contract.
- [x] Forward sidecar timing records and add core `sidecar.spawn` and
      `sidecar.recycle` spans under the timings contract.

- [x] Restrict static fingerprints to configured roots, inventoried sources,
      and reached closure files. Measure this boundary under the large fixtures.
  - [x] Verify captured bundle inputs against sidecar module digests before
        document callbacks; retain those baselines through the live recheck.
- [ ] Report exact consumed-byte digests for the PostCSS module graph and
      plugin file dependencies, and use them as static fingerprint baselines.
      Design how to capture the bytes that module evaluation and plugins read,
      or supply immutable generation inputs. Paths and rereads after a plugin
      runs cannot establish the consumed bytes. Plugin file dependencies outside
      roots and bundle modules without witnesses retain an accepted late baseline.
  - [x] Compare read observers with immutable PostCSS inputs, including native
        plugins, child processes, descriptors, cost, and supported platforms.
  - [x] Decision 56 A, approved 2026-10-19: add observed-read evidence in
        stages and keep explicit incomplete coverage and late opaque baselines.
        Preserve native plugin compatibility. Do not infer complete coverage
        from one observed read. Alternatives were B, enforced immutable inputs,
        and C, continued deferral. A improves common reads without new isolation
        or platform requirements.
  - [x] Record raw local compiler inputs, observable native module sources,
        and path-based sync, callback, and promise whole-file reads. Retain
        distinct witnesses through context reuse, result caches, stylesheet
        caches, and worker replacement. Check them before document callbacks
        and final installation through the existing input-change outcome.
        Compare base source witnesses with pinned Git bytes, separate from head
        baselines. Custom loader text without raw provenance stays incomplete.
  - [ ] Complete the remaining coverage: native/helper/worker reads, preloaded
        file providers, descriptors, streams and ranges, older-runtime transitive ESM loading, private
        resolution metadata, and read-time path identity. The full M14 item
        remains open. No path or context is labelled complete.
        Design: `.context/rust-rebuild/delegation/m9-compare/design-postcss-digests.md`.
        Stage evidence: `.context/rust-rebuild/m14-postcss-read-evidence/`.

- [ ] Port the large fixture generator with HTML and React variants and the
      four-scenario benchmark harness; record the time and memory budgets, the
      dependency install time limit, and the render and install cache bounds
      in the timings contract once approved.
  - [x] Port HTML/React generation, both-variant build, and HTML Serve measurement.
  - [x] Measure React Serve on a suitable machine with a configurable memory stop.
        At `a3cc0828`, the default 1,620-route/5,850-document React fixture used
        two sidecars, default deadlines, workspace dependencies, and a 6 GiB
        whole-harness RSS stop. Cold/warm usable startup: 184.370/183.713 s;
        both failed the unchanged 5 s budget. Browser checks passed. CLI RSS
        peaks: 1,368,268/1,591,676 KiB; whole harness: 2,744,332/3,435,732 KiB.
        Same eight-CPU, 16.25 GiB machine and development build as the M9 repeat.
        Evidence: `.context/m14-measurements/large-react/.context/measurements.json`.
  - [x] Resolve the React large-fixture startup budget failure. `graph.prepare`
        took 167.990/167.741 s in the cold/warm development-build observations.
        Profile preparation and repeat with the intended acceptance build profile.
        Apply decision 57 C: React usable startup stays below 15,000 ms on the
        optimized release build; HTML stays below 5,000 ms.
    - [x] Enforce variant-specific startup acceptance on a verified release
          binary and repeat the large React startup measurement.
          At `caf7b383`, the default React fixture passed at 8.564/8.533 s
          cold/warm with two sidecars, default deadlines, and a 6 GiB RSS stop.
          The focused startup selection checked real previews, search, axes,
          props, cached bytes, and a page. The machine had eight CPUs and
          16.25 GiB RAM. Evidence: `.context/m14-round3/measurements-summary.json`.
          Merge preservation: `.context/m14-round3/merge-decisions.md`.
    - [x] Measure optimized startup and profile core, sidecar, and serial work.
          The release baseline at `9257b131` used the same fixture, two sidecars,
          default deadlines, and 6 GiB RSS stop. Cold/warm usable startup:
          24.838/25.858 s. Core preparation used one CPU; sidecars were idle.
          Evidence: `.context/m14-round2/baseline/`.
    - [x] Share routing inventories and remove repeated stylesheet-root walks.
          Preserve routing-key snapshots, stylesheet order, and result checks.
          Operation counts cover both input sizes. The final release source
          tree `9ad26d863edb4eb7cfe3f0e8178c696c3d005c04` took 10.551/10.538 s
          cold/warm. Core preparation fell to 0.260/0.177 s; stylesheet-root
          discovery took 2 ms. Compilation still took 7.491/7.019 s.
          Both browser checks passed; both startup budget checks failed.
          Evidence: `.context/m14-round2/final/`.
    - [x] Settle the remaining startup approach with decision 57 C on
          2026-10-19. Keep complete readiness and approve React startup below
          15,000 ms on the release build. Defer compilation redesign to the
          non-blocking follow-up.
  - [x] Connect Changes and watch to their delivered browser events.
        Evidence: `.context/m14-harness/browser-focused.log` and
        `.context/m14-harness/watch-smoke/.context/measurements.json`.
  - [x] Drain browser measurements and restore sources before reporting failure
        when Serve stops, including runs with a caller-owned browser.
        Evidence: `.context/m14-harness/cleanup-green.log` and `review.md` there.
  - [x] Measure `review.capture-side` retained and uncaptured views on the large
        fixture (M9 engine review 9 finding 1). Keep the capture bound and
        per-entry charges until the capacity measurements support a decision.
        At `a3cc0828`, both default fixtures retained 5,850 views and left zero
        uncaptured. HTML/React retained 66,405,523/83,932,642 bytes and encoded
        19,511,762/37,797,065 bytes. Capture spans: 759.466/1,025.018 s.
        Capture-phase process-family PSS peaks: 0.834/1.510 GB with RSS fallback.
        Two sidecars, default deadlines, and a 6 GiB stop on the same machine.
        Stop after capture; complete Changes classification was not measured.
        Keep the 256 MiB bound and every per-entry charge.
        Evidence: `.context/m14-measurements/capture-html/summary.json` and
        `.context/m14-measurements/capture-react/summary.json`.
  - [x] Profile optimized capture throughput and remove repeated work without
        changing the capture bound, entry charges, or preparation contracts.
    - [x] Reuse anchor-check destination renders through the bounded cache.
          Evidence: `.context/m14-capture/anchor-release-html/analysis.json`
          and `.context/m14-capture/anchor-release-react/analysis.json`.
    - [x] Measure sidecar waits and capture encoding, then use bounded capture
          batches on the existing render workers without changing retention order.
          Integration evidence: `.context/m14-capture/merge-resolution.md`.
          Evidence: `.context/m14-capture/observations.json` and
          `.context/m14-capture/parallel-release-react/analysis.json`.
    - [x] Coalesce concurrent anchor-target renders and preserve cache bounds.
          Evidence: `.context/m14-capture/coalesced-release-html/analysis.json`
          and `.context/m14-capture/coalesced-release-react/analysis.json`.
  - [x] Retire completed anchor and fragment requests through scoped leases.
        Close capture-throughput review finding 1 with option B.
        Evidence: `.context/m14-capture/review-clarification.md` and
        `.context/m14-capture/review-f1-tests.log`.
  - [x] Preserve capture timings through the shared stage-selection split.
        Integration evidence: `.context/m14-capture/merge2-resolution.md`.
  - [x] Skip already loaded sidecar replay inputs and share binding revisions.
        Keep replay order, deadlines, updates, and recycling unchanged.
        Evidence: `.context/m14-capture/replay-green.log` and
        `.context/m14-capture/replay-release-react/analysis.json`.
  - [x] Decide whether to combine validation and capture through bounded ordered
        collection. Severity Medium, effort Large. Recommended: B, share the
        validated inputs. Decision: `.context/m14-capture/design-decision.md`.
        User decision 62 (2026-10-20): A, keep the two passes now. B, one
        bounded, ordered collector, is a post-merge follow-up.
  - [x] Verify the comparison engine's tree walks after M9 integration.
        Cover recursive `owned_styles::visit`, `owned_style_instances::walk`,
        and `inline_styles::collect` in `mokly-compare`. Also remove the
        per-element copy of enclosing instances in `owned_style_instances::walk`.
  - [ ] Resolve rendered-depth recursion in the `selectors` crate's `:has()`
        matching path. Its subtree search uses one native frame per rendered
        tree level. A depth bound or an explicit-stack matcher needs the user's
        decision before implementation (M14 review 5, finding 1).
  - [x] Measure isolated dependency installs and propose additional budgets;
        retain the approved variant-specific usable startup budgets.
        At `0cda750a`, isolated dependency preparation took 28.076/20.160 s with
        cold/warm npm caches, including package packing. `npm ci` took
        7.328/5.446 s. Full fixture setup, including catalogue generation and
        Git setup, took 28.948/21.024 s.
        Setup process-family RSS peaked at 784,814,080/916,635,648
        bytes. Both installed CLI and React rendering smoke checks passed.
        Unmodified setup failed twice: `EUSAGE`, four non-host native packages
        missing from the lockfile. Measurements used fixture-only metadata
        archives for those skipped optional targets. No product code changed.
        Evidence: `.context/m14-measurements/install-metadata-cold-evidence/summary.json`
        and `.context/m14-measurements/install-metadata-warm-evidence/summary.json`.
  - [x] Repair isolated setup for unpublished non-host native packages and
        repeat the install measurements without fixture-only overrides.
        Reproduce with `fixture:large --toolchain install` at `0cda750a`.
        Evidence: `.context/m14-measurements/install-cold-evidence/summary.json`.
    - [x] Repair single-host isolated setup and record three unmodified installs.
          Evidence: `.context/m14-installs/measurements.json` and `report.md` there.
  - [x] Approve isolated-setup budgets after the repair, decision 55 B on
        2026-10-19: under 60,000 ms and under 1.5 GiB setup-family RSS,
        including the setup harness.
    - [x] Enforce both isolated-setup budgets with synthetic boundary tests
          and repeat one complete isolated install.
          At `caf7b383`, full React fixture setup took 23.567 s with an empty
          dedicated npm cache. Setup-family RSS peaked at 821,160 KiB across
          472 samples at 50 ms intervals. Both budgets passed. Product release
          preparation preceded measurement; installed binary verification passed.
          Evidence: `.context/m14-round3/isolated-react/.context/setup.json`.
- [ ] Run the fixture and the Mokly Cloud catalogue through build, serve,
      Changes, and watch; save the evidence under `.context/rust-rebuild/`.
      The bookfolio run is a post-merge follow-up (user, 2026-10-20).
  - [x] Port and verify Mokly Cloud in a scratch copy with Build, Serve,
        source Changes, and watched screen, component, and stylesheet edits.
        Keep the source repository unchanged.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-18.md`.
  - [x] Profile the memory guard stops in repeated Mokly Cloud comparisons.
        Separate retained generation data from allocator residency before
        changing cache limits or rendering behaviour.
        Release the startup generation after its publication handoff. Verify
        disposal while Serve stays open across two source replacements.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-19.md`.
        Merge decisions: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m14-cloud-memory/merge-decisions.md`.
  - [x] Settle compiled-recipe retention under F8 decision 59 A. Keep the current
        lifetime and the recorded Cloud observations. Option C remains a
        post-merge follow-up with an explicit byte budget still to be agreed.
- [x] Make tree conversion, composition, serialization, destruction, and all
      tree walks iterative; remove dependence on the temporary 64 MiB stacks.
      The M5 memory follow-up removes quadratic ancestor-list retention and
      subtree copies in link controls. Evidence:
      `.context/rust-rebuild/delegation/m5/memory-report.md` and `report-4.md` there.
- [x] Review the `plaintext` re-parse limit: closing tags can become text, so repeated parsing can change the tree (M5 review 2, finding 6).
- [ ] Decide whether reconstructed `plaintext` text writes raw characters;
      keep its escaping rules until approved (M14 review 1a finding 1B).
- [x] Resolve authored-input recursion in YAML front matter (`mokly-catalogue`),
      CSS scanners (`mokly-css`), and `lightningcss`. The HTML tree guarantee
      excludes these paths. New input bounds or wider rewrites need a decision.
  - [x] Make the YAML builder and Mokly's CSS scanners iterative, and keep YAML
        source positions linear in the node count. Child-process depth searches
        on 2 MiB stacks cover each parser and pipeline.
        Evidence: `.context/m14-nesting/report.md`.
  - [x] Keep CSS Modules name ranges after an attribute selector, so
        `.a[x]:global(.b)` no longer fails the token check.
  - [x] Limit the CSS Modules empty-wrapper and ICSS checks to selectors and
        `@scope` preludes; other at-rule preludes stay as authored, as
        css-loader does. Decision: nesting report item 13 option A, approved
        by the orchestrator on 2026-10-20.
  - [x] Reject an empty `:global()` or `:local()` wrapper in a keyframes name
        with the catalogued empty-wrapper message. Decision: nesting report
        finding 15 option B, decided by the orchestrator as protocol alignment
        on 2026-10-20.
  - [x] Give an empty wrapper in a keyframes name its own catalogued words,
        which ask for the name. Decision: nesting report finding 18 option B,
        approved by the orchestrator on 2026-10-20.
  - [x] Reject a YAML front matter value more than 128 levels below the root
        with `html-front-matter` before serde-derived traversal and schema
        inference, and accept the `lightningcss` gap. Decision: item 36 option
        B (nesting report decision 10 B), applied by default (user rule),
        2026-10-20.
- [x] Replace the old baseline-output cold reset with M9 leased-cache preparation
      and delivered Changes measurements in the M14 harness.
      Evidence: `.context/m14-harness/changes-tests-3.log` and
      `.context/m14-harness/changes-smoke/`.
- [x] Measure generation source-snapshot retention and per-root CSS asset
      preparation with large asset inputs; keep total working memory within
      the approved acceptance budgets, in addition to the artifact-cache bound.
      Digest-only repeat at `0cda750a` on the same machine: 48 routes and 166
      documents; four PNG assets shared by four CSS roots; `build --no-changes`.
      Asset inputs: 16,790,336/67,152,192 bytes. Final source retention stayed
      70,425 bytes. First asset-root preparation: 339/1,368 ms; each other
      sharing root: 0–1 ms. Build: 4.022/10.033 s; CLI RSS: 142,196/192,128 KiB;
      whole harness RSS: 348,316/383,028 KiB, below its 4 GiB observation stop.
      All eight output hashes matched; each asset had one generated output.
      These are observations, not new total-memory acceptance budgets.
      Evidence: `.context/m14-measurements/assets-16mib/.context/measurements.json`
      and `.context/m14-measurements/assets-64mib/.context/measurements.json`.
  - [x] Measure repository snapshot payload and CSS-root preparation with large
        asset inputs through the guarded build harness.
  - [x] Review opaque CSS asset retention before a redesign or larger probes.
        Private source snapshots pin these bytes without a byte bound. Preserve
        generation consistency when choosing how to limit retained data.
- [x] Review the CSS matching tree's per-element containment-list copies.
      Retention grows with element count times nesting depth. Decide on shared
      containment storage with the CSS attribution work (M14 review 5, finding 2).
      Shared parent links preserve attribution and remove the copies.
      Evidence: `.context/rust-rebuild/m9-lookup-and-matching/containment.md`.
- [x] Make opaque CSS assets digest-only inputs: store the route, path, and
      digest instead of the bytes; use the digest in the cache keys; stream the
      bytes at delivery and check them against the digest; one entry per asset
      path across roots; first audit and record the copies of each asset per
      build with the harness.
- [x] Decide on one shared verified opaque-asset spool per generation and
      route with the M14 Serve budgets. Account for GET and HEAD capture work,
      live response files after worker permits end, and OS temporary storage
      outside process RSS (M14 review 6, finding 5; accepted interim design A).
      User decision 61 (2026-10-20): A, keep one private capture for each
      request. `mokly-imported-styles-assets.md` documents its bound. A
      shared spool is a post-merge follow-up.
- [ ] Measure Git opaque-asset digest commands and buffered delivery under
      the M14 comparison workloads. Use the cost to decide on streamed blob
      copies and batched digests; keep the 64 MiB Git bound (review 6, finding 8B).
      Evidence: `.context/rust-rebuild/m9-lookup-and-matching/git-assets.md`.
  - [ ] R20-1: Decide on streamed Git blob copies and batched digests.
        Severity Low, effort Large. Recommended: A, remove per-asset process
        startup and the extra full-blob buffer. Preserve all existing bounds.
        Option B retains the measured adapter. No option is applied.
- [ ] Complete the gap sweep: every triage decision is in a spec or recorded
      as an accepted difference for the release note.
- [ ] Commit.

- [x] Verify that a sidecar emitting a large stderr stream drains safely at
      shutdown and leaves no process behind (M11 sweep, watched_serve case).

Sidecar timing and stderr acceptance: `.context/rust-rebuild/delegation/m12-static/report-11.md`.
Sidecar merge decisions: `.context/rust-rebuild/delegation/m12-static/merge-decisions.md`.

Part 1 evidence: `.context/rust-rebuild/delegation/m14/report-1.md`.
Part 1 gap sweep: `.context/rust-rebuild/sweeps/m14-part1.md`.
Part 1 round 2 evidence: `.context/rust-rebuild/delegation/m14/report-2.md`.
Part 1 round 3 evidence: `.context/rust-rebuild/delegation/m14/report-3.md`.
Input fingerprint and memory evidence: `.context/rust-rebuild/delegation/m14/report-4.md`.
Input fingerprint review evidence: `.context/rust-rebuild/delegation/m14/report-5.md`.
Final fingerprint fixes and replay evidence: `.context/rust-rebuild/delegation/m14/report-6.md`.
Comparison walk and timing-field evidence: `.context/rust-rebuild/delegation/m14/report-7.md`.
Comparison review corrections and CSS asset evidence: `.context/rust-rebuild/delegation/m14/report-8.md`.
Opaque asset review fixes and merged verification: `.context/rust-rebuild/delegation/m14/report-9.md`.
Final asset fixes and engine integration: `.context/rust-rebuild/delegation/m14/report-10.md`.
Final asset merge decisions: `.context/rust-rebuild/delegation/m14/merge-decisions-2.md`.
Part 1 merge decisions: `.context/rust-rebuild/delegation/m14/merge-decisions.md`.
Integration batch 1 decisions: `.context/rust-rebuild/delegation/integration/merge-decisions-1.md`.

Integration batch 2 decisions: `.context/integration-2-merge-decisions.md`.
Integration batch 3 decisions: `.context/integration-3-merge-decisions.md`.
Integration batch 4 decisions: `.context/integration-4-merge-decisions.md`.
Integration batch 5 decisions: `.context/integration-5-merge-decisions.md`.
Integration batch 6 decisions: `.context/integration-6-merge-decisions.md`.
Integration batch 7 decisions: `.context/integration-7-merge-decisions.md`.
Integration batch 8 decisions: `.context/integration-8-merge-decisions.md`.
Integration batch 9 decisions: `.context/integration-9-merge-decisions.md`.
Integration batch 10 decisions: `.context/integration-10-merge-decisions.md`.
Integration batch 11 decisions: `.context/integration-11-merge-decisions.md`.
F2 duplicate-fix reconciliation: `.context/f2-reconcile/merge-decisions.md`.

## Milestone 15: Verification, close-out, and review

- [ ] Move the 0.14-era notes in `npm-release-notes.md` and the format note to
      the history page at close-out; retain their links and migration content.
      Commit `05923728` already moved the Publish Checkout, Removed Public
      Options, and Portable Namespace notes there.

- [ ] Run `cargo xtask check`; fix anything it reports until it passes.
- [ ] Commit and push.
- [ ] Open the pull request. Its description and squash body write `{target}`
      for the package placeholder, justify each merge decision with its paths,
      and record every approved removal.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
  - [x] Fix integration batch 3 review finding 1: keep original ownership
        metadata separate from resolved Usage destinations. A transferred
        variant follows its own pair when its donor survives or is removed.
        Evidence: `.context/integration-3/review-fixes/`.
  - [x] Fix integration batch 3 review finding 2: keep the focused design
        test command in the CLI README and preparation mechanics in fixture
        comments. Retain the default-suite requirement in the protocol.
        Evidence: `.context/integration-4/`.
  - [x] Fix integration batch 4 review finding 1: select comparison flags
        through one helper. Builds with Changes disabled omit the pinned
        base. Default builds and Serve retain the fixture's pinned base.
        Evidence: `.context/integration-4/review-fix/`.
  - [x] Split core timing stage selection after integration batch 5 combines
        stop timing and startup stages. Retain every stage and the file cap.
        Evidence: `.context/integration-5/length-before.log` and `targeted.log`.
  - [x] F3 item 1: the orchestrator approved F2 decision B on 2026-10-19.
        Use the resolved variant as the canonical affected consumer when its
        original parent has no destination. Keep the original evidence paths.
        Reject omission of valid variant evidence. Never link to a replacement
        document or restore the suppressed parent. The lookup protocol defines
        the fallback. Evidence: `.context/f3/item-1-red.log` and `item-1-green.log`.
  - [x] F3 item 2: release the authorization snapshot before reading a render
        request body. Take the validation snapshot after the body arrives.
        Keep the revision fence. Held-body tests prove snapshot and base-capture
        release through weak references without sleeps.
        Evidence: `.context/f3/item-2-red-corrected.log` and `item-2-green.log`.
  - [x] Decision 54A, approved on 2026-10-19: warn on extglob-shaped stylesheet
        matchers and suggest brace alternatives. Keep globset matching and the
        existing strict-warning policy. Reject silent omission of the diagnostic.
        F4 defines `stylesheet-extglob`, tests all five openings and exact
        terminal output, and verifies strict failure before output replacement.
        Evidence: `.context/f4/`.
  - M9 reference replay verification: investigate the unchanged
    `html_preparation_failure_flushes_once_and_repair_prints_only_new_warnings`
    test's `warning.0 < failure` assertion failure. Its isolated rerun passed.
    Suspected source: asynchronous watcher or reporter ordering; not proven.
    Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round15/repository-final.log`
    and `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round15/serve-warning-rerun.log`.
  - M9 reference replay verification: investigate the unchanged
    `static_deployment` copied-catalogue reload test's transient
    `404 /mokly-viewer/client/inspector.js`. Its isolated rerun passed.
    Suspected source: an in-flight request during the fixture's two directory
    renames. Keep the requested-file and browser-error assertions.
    Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round15/browser-3.log`
    and `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round15/static-deployment-rerun.log`.
  - F1 follow-up finding 1: settled by the orchestrator on 2026-10-19,
    decision 1A. Keep `aria-current` on both links because both open the
    current page. Check Default-only selection through the active class.
    Reject changing the current-page marks to follow row selection. This
    keeps the self-link decision in `be30a10a` and changes no protocol.
    Merge preservation: `.context/f1-round2/merge-decisions.md`.
  - [x] Resolve the F1 tracing failure in
        `serve_trace::serve_trace_tests::unsuccessful_review_spans_remain_error_and_emit_no_complete_counts`.
        The earlier failure reported an original Unimock destroyed on another
        thread. Commit `7b4dd657` retains original mocks until the tracing
        subscriber releases its clones. The requested merge includes this fix.
        Evidence: `.context/f1-round2/serve-trace.log`.
  - [x] Resolve the M9 engine round 15 preparation-warning test flake in
        `html_preparation_failure_flushes_once_and_repair_prints_only_new_warnings`.
        Match the watched source's failure line, so a delayed Git comparison
        diagnostic cannot become the preparation failure. Keep every warning,
        ordering, repair, and cleanup assertion. A controlled log sequence
        proves the old failure; the fixed case passes 20 isolated runs.
        Evidence: `.context/rust-rebuild/delegation/flake-fixes/report-1.md`.
  - [x] Resolve the M9 engine round 15 copied-deployment test flake in
        `static_deployment.spec.ts`. Publish immutable copies through one root
        selection per request. A controlled request between the old renames
        proves the 404; a held-request test keeps each response on its selected
        copy. The browser case passes 20 runs in distinct workers with every
        assertion retained. Evidence: `.context/rust-rebuild/delegation/flake-fixes/report-1.md`.
  - [x] F11: resolve the copied-deployment reload assertion race. Wait for the
        initial previews and the replacement document load before checking its
        title and marker. Keep every assertion and the atomic publication fixture.
        Evidence: `.context/f11/reproduction.md`.
  - M12 review 8 verification: investigate the unrelated
    `events_send_the_current_identity_at_once_and_shutdown_closes_the_stream`
    port-rebind assertion failure. The isolated rerun passed. Suspected source:
    ephemeral-port reuse or socket teardown timing. Evidence: M12 `report-12.md`.
  - M9 engine round 13 verification: the unchanged desktop
    `design_modern_controls` sweep and `link_controls` setup each hit their
    60-second limit. All seven affected cases passed unchanged in a focused
    run and the full shard rerun. Suspected source: shared-machine load.
    Track this with the M8 browser timing measurements below.
    Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-13.md`.
  - M14 walk verification: `interrupt_drains_and_stops_a_hung_sidecar` and
    `one_process_group_signal_through_the_shim_drains_the_sidecar` reported
    `sidecar render readiness: Disconnected` during a concurrent package
    rebuild. Both passed in an isolated rerun and the final repository suite.
    Suspected source: shared built files changed during the tests. Keep builds
    and suites separate. Evidence: M14 `report-7.md`.
  - [x] Resolve both HTTP port-rebind assertions in
        `events_send_the_current_identity_at_once_and_shutdown_closes_the_stream`
        and `incomplete_requests_close_and_a_failed_hook_does_not_skip_cleanup`.
        Another bind can take the released port. Prove listener release through
        the injected acceptor's weak reference after `run` returns, including a
        failed cleanup hook. Keep clean event-stream closure and error details.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/report-9.md`.
  - [x] M9 engine round 14 verification: the incoming
        `spawn_and_replacement_cover_hello_and_keep_error_until_success` test
        failed once because an original Unimock was destroyed on a different
        thread. The isolated case and the complete CLI/compare rerun passed
        unchanged. Suspected source: cross-thread mock ownership during pool cleanup.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round14/cli-compare.log` and `cli-compare-retry.log` there.
        Fixed by `7b4dd657`: retain original mocks and await tracing subscriber
        release. The recorded panic comes from the timing capture terminal mock.
        Evidence: `.context/rust-rebuild/delegation/m8-callback-fixes/report-1.md`.
  - [x] Integrate browser fix `f81b7744` for the M14 `design_modern_controls`
        screen-loop timeout. It splits screens into five groups of at most
        12 screens and keeps the per-test limit. The rebuild tip `690eb698`
        contains this commit. Verification: M14 `report-9.md`.
  - [x] Integrate browser fix `9653a6d0` for the M14 `link_controls.spec.ts`
        fixture-startup timeout. It gives the `beforeAll` hook the approved
        180-second preparation budget. The rebuild tip `690eb698` contains
        this commit. Verification: M14 `report-9.md`.
  - [x] Resolve the M14 `static_comparison_deployment.spec.ts` navigation race.
        Commit `9299c3c0` waits for replacement and the new stylesheet bytes.
        Verification: M14 `report-9.md`.
  - [x] Resolve the Serve Changes verification sidecar `EPIPE` flake through
        accepted commit `e10af987`. The sidecar stops on closed parent pipes.
        The regression is `postcss_failures_use_exact_catalogued_codes_and_logical_paths`.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/report-8.md`.
  - [x] Reconcile the inherited M14 round 3
        `resident_set_recycles_only_after_one_gib_is_exceeded` flake with M9.
        The shared fixture seeds its epoch and cleanup uses one staleness rule.
        The M14 isolated rerun passed; its missing epoch let idle cleanup take
        the asserted slot. Evidence: M14 `report-3.md` and
        `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round9/merge-recycle-regression.log`.
  - M8 browser review 3 finding 1, High severity, Medium effort: approve two
    hosted PR measurements with fresh and restored caches before Required CI.
    Keep four shards, the job timeout, and the 60-second test timeout until
    the user decides from measured setup, shard, and slow-case durations.
    Recommended A: measure.
  - [x] M10 shard follow-up: both cases of `design_modern_controls.spec.ts`
        "every selected screen uses one icon footer and one view toolbar"
        timed out once under load in shard 2. Fixed by `f81b7744`, which
        splits the screen loop into five groups of at most 12 screens
        (medians 3.6 to 7.2 seconds per group). Evidence: m7 `report-20.md`
        and m8-browser `report-7.md`.
  - M8 browser follow-up, Low severity, Small effort: investigate the existing
    `frame_adapter_navigation.spec.ts` posted-message assertion. It returned
    no navigation event once and passed unchanged after rerun. M8 viewer owns
    the suspected message/animation-frame ordering. Recommended A: wait for
    the message event. Evidence is in the browser delegate's `report-4.md`.
  - M8 browser follow-up, Low severity, Small effort: investigate the
    `static_cors.spec.ts` public embedded viewer case. It reported the blocked
    script notice from `about:blank` once and passed unchanged in isolation.
    Suspected source: clock or trace injection during sandboxed frame
    navigation. Keep the assertions and console policy. Recommended A: confirm
    the notice origin before a separate fixture fix. Evidence: M12
    `report-13.md` and `round13-gate-attempt1-failures.json`.
  - [x] Resolve the loaded stderr and recovery signal test failures. Acknowledge
        command diagnostics before shutdown, check graceful exit and the final
        tail through direct sidecars, and retain mocked shared-deadline checks.
        Split recovery faults into independent cases and make readiness and
        process-group cleanup follow test cancellation. The Unix abort check
        waits for the complete native gate marker before cancellation.
        Keep every assertion and
        snapshot payload. Evidence: M12 `report-13.md`,
        `round13-load-counts.json`, and `round13-load-after.json`.
  - [x] M8 sidecar follow-up, Low severity, Small effort: the Rust test
        `serve_trace::sidecar_trace_tests::spawn_and_replacement_cover_hello_and_keep_error_until_success`
        in `mokly-cli` failed once in `cargo test --workspace` with "Original
        Unimock instance destroyed on a different thread than the one it was
        created on", then passed 20 isolated runs and 15 runs of the whole
        `mokly-cli` binary test set. Suspected source: the sidecar pool drops a
        replaced worker's mock on another thread, depending on timing.
        Recommended A: clone the mocks before they move to the pool, as the
        message says. Separate branch. Evidence: m7 `report-23.md`.
        Fixed by `7b4dd657`. Controlled cross-thread drops reproduce the error;
        original mocks stay on their owner thread through subscriber and pool
        completion. Evidence: `.context/rust-rebuild/delegation/m8-callback-fixes/report-1.md`.
  - [x] M10 Serve and moved rows decision 6, Severity High, effort Small:
        apply F5 option A, approved on 2026-10-20. Selected variant comparisons
        keep the parent with only the selected variant, preserving parent-owned
        evidence instead of returning 503. The Card Featured browser case
        verifies both panes. Evidence: `.context/f5/report.md`.
  - [x] Switch the three Serve specs that used the Badge family back to the
        Card family now that decision 6 has landed. Done by `1baf1aa8` on
        2026-10-20.
  - [x] Batch 8 restores the Card family in the selected comparison,
        expiry, and renewal-pane journeys after the F5 integration.
  - [x] M10 Serve and moved rows review 1, findings 1 to 4, fixed on
        2026-10-20 as the orchestrator asked:
    1. Expiry emulation could not fail its snapshot checks. Fixed by
       `7ec5673a` (C): one shared helper emulates a complete collection.
    2. Renewal fence checks passed before the late response. Fixed by
       `bbc763a8` (B): the held renewal release waits until the browser ends
       each held request, and reports whether the page cancelled it.
    3. The regression test proved one shape of the fix. Fixed by `ebe7dccc`
       (A): CLI tests for a lost Dark view, a variant that gains Dark, and a
       removed component with a surviving consumer.
    4. The copy dropped the moved variant comparison. Fixed by `a230499c`
       (A): the branch copy registers it too.
  - [x] M10 Serve and moved rows review 3, finding 7: the kept ports lacked two
        steps of the dropped copies. Fixed by `0a9a8be8` (B) on 2026-10-20.
  - [x] M10 Serve and moved rows decision 10, Severity Low, effort Small:
        apply F5 item 2. Each sweep override lists the old checks that its port
        does not prove, and a dropped duplicate moves its extra checks into
        the kept port. The sweep procedure now states this rule. Covers
        review 3 findings 1 and 2 and review 4 finding 2; previous examples
        0858e172, 4d6a21a4, and abf52983. Evidence: `.context/f5/report.md`.
  - M10 Serve and moved rows decision 10 was decided A by the orchestrator on
    2026-10-20. The line above records how followups-f5 applied it.
  - [x] M10 Serve and moved rows review 4, findings 12 and 13, fixed on
        2026-10-20: the restored removed-variant journey keeps its parent
        unchanged (`bd05ab75`, B), and the poll comment names no duration
        (`437154a8`, A).
  - [x] M10 Serve and moved rows reviews 5 and 6: comments and README text
        that described a failed advertised renewal as Serve's collection, and
        a README clause that gave the 404 rule a wrong scope. Fixed by
        `814fc1b1` and `0571ba15`.
  - [x] M10 Serve and moved rows review 5, finding 15: the emulated collection
        of a selected generation started only at its renewal. Fixed by
        `3f93a581` (B) on 2026-10-20: the generation is gone once the pane
        documents have loaded. The rewrite also stops a refresh that already
        asks for one from leaving a later plain request to be forced.
  - [x] M10 Serve and moved rows review 6, finding 18: the helper names said
        "collection". Renamed by `a58da357` on 2026-10-20, as the orchestrator
        asked: `serve_generation_removal.ts`, `removeGeneration`, and
        `RemovedGeneration`.
  - [x] M10 Serve and moved rows review 7, on 2026-10-20: the Card parent
        panes prove each side again by their `.accent` colour (`06158d40`),
        and the plan dates decision 10 again after merge `8fa9f338` kept only
        the f5 line.
  - [x] M10 Serve and moved rows decision 21, Severity Low, effort Small: one
        shared Card pane check that proves each pane's side. Covers review 7
        finding 19. Decided B by the orchestrator on 2026-10-20: one helper,
        `expectCardPane` in `tests/browser/serve_comparison_ui.ts`, checks
        every Card pane on Serve by its heading and its side's `.accent`
        colour. Done by `f858cc02`.
  - [x] M10 Serve and moved rows review 9, finding 22, Severity Low, effort
        Small: the Usage row key tests missed the removal state and the list
        order. Decided A by the orchestrator on 2026-10-20: a removed row
        keeps its key alone and beside the current row of its entry, and a
        row keeps its key with and without another entry's row before it.
        Done by `e1ff6c97`.
  - [x] M10 Serve and moved rows review 10, residual risk, follow-up F9b item
        1, given by the orchestrator on 2026-10-20: the Usage row key tests
        still accepted a key with the first link's instance key and a key
        built from the title. Two cases reject them: a row keeps its key when
        another instance of its entry comes first, and beside another entry
        with the same title. A mutation run proves each case.
  - [x] Follow-up F9b review, on 2026-10-20: finding 27 is fixed by
        `3038f6de`. Findings 24 (`2a0df638`), 25 (`1b391e86`), and 26
        (`0ef0e0a3`) are applied with reasons: they restore checks that this
        branch dropped, or finish item 6. Finding 28 is corrected in the
        round's sweep rows.
  - [x] F9b review finding 29: two test modules exported
        `branchPointCases` with different lists. Decided B by the
        orchestrator on 2026-10-20, as follow-up F15 item 1. The delivery
        list `branchPointDeliveryCases` reads each removed record's path and
        parent title from the shared cases and keeps its selectors and
        texts. It equals the old list, and its guards stop a missing case.
  - [x] F9b re-review, on 2026-10-20: finding 31, a stale comment in
        `branch_point_cases_tests.rs`, is fixed by `aa296afc`.
  - [x] F9b re-review finding 30: the mobile embedded runs did not assert a
        narrow viewer. Decided B by the orchestrator on 2026-10-20, as
        follow-up F15 item 2. Each host's `compactSearch` marker says
        whether a narrow window shows the compact search control. Opening an
        entry and searching expect the control or the field from it. Without
        `responsive=1`, all ten mobile embedded runs fail and the desktop
        runs pass.
  - Outside the F9b re-review scope:
    - `packages/viewer/src/shell/top_bar.tsx:21`: the open compact search
      hides the menu button and stays open after a row activation. Separate
      branch.
    - `docs/protocol/mokly-viewer.md:302`: no test checks that Close or
      Escape restores the compact search control and its focus, or that host
      slots stay mounted. Separate branch.
    - Commits `2a0df638` and `0ef0e0a3` have titles of 56 and 51 characters,
      past the 50-character limit. They are pushed, so they stay as they are.
  - Outside the scope of the M10 Serve and moved rows review:
    - `docs/protocol/mokly-selected-comparisons.md:132-134`: the
      Verification paragraph asks for an advanced server clock, and Serve
      has no test hook for it. Separate branch.
    - `docs/protocol/mokly-branch-point-lookup.md:115`: one shared set of
      base commits must feed Rust and browser tests, but Rust reads
      `tests/fixtures/branch_point_cases.json` and the browser writes its
      own sources. Separate branch.
      - [x] Follow-up F9b item 5: the JSON now holds the browser's five
            namespaced cases with their pairs, removed titles, and affected
            consumers. Rust runs each case in its own repository. The browser
            helper writes every case into both commits, byte for byte as the
            old generator did. The browser checks are keyed by the case
            names, and both readers stop on a missing case. No behaviour or
            protocol change was needed.
    - `docs/protocol/mokly-branch-point-lookup.md:129`: the five journeys
      must run through Serve, `build`, and the embedded viewer, but they run
      only on the branch copy. Done in round 4 of the D1 delegate.
      - [x] Follow-up F9b item 6: `branch_point_cases.ts` registers the five
            cases at desktop and mobile widths on each host:
            `branch_point_comparison_ui.spec.ts` on the branch copy,
            `serve_branch_point.spec.ts` on Serve, and
            `viewer_branch_point.spec.ts` in the embedded viewer through both
            frame adapters. Serve waits for each on-demand comparison, and
            the embedded viewer checks the selected entry without an address.
      - [x] F15 merge of the rebuild tip `e709a7cd`, on 2026-10-20: round 4
            of the D1 delegate and F9b item 6 ran the cases on the same three
            hosts. The merge keeps the D1 specs and their page path checks,
            moves the F9b checks into them, and removes the two F9b host
            specs. Merge decisions: `.context/m10/f15/merge-decisions.md`.
    - `tests/helpers/branch_point_sources.ts`: no folder-own entry sits above
      `branch/parent`, so no journey ports the old step that opened the
      removed sibling through a container row. Separate branch.
      - [x] Follow-up F9b item 4: the unchanged component index
            `branch/parent` is the folder's own page. The moved parent check
            now activates its container row, which opens the moved parent,
            and under the search `secondary` opens the removed sibling.
    - `tests/browser/branch_point_checks.ts:242`: the comment calls the check
      keys the shared case names, but no key equals a name in
      `tests/fixtures/branch_point_cases.json`. Separate branch.
      - [x] Follow-up F9b item 4: the comment now says that each key is the
            case title that starts each test name.
    - `tests/browser/static_component_comparisons.spec.ts:32`,
      `removed_previews_static.spec.ts:76`, and
      `removed_previews_viewer.spec.ts:173`: they repeat the Card `.accent`
      colours as literals instead of reading `accentColor`. Separate branch.
      - [x] Follow-up F9b item 2: the three specs read `accentColor` from
            `tests/helpers/comparison_catalogue.ts`, which also writes the
            colours into `theme.css`. With only the fixture's Before colour
            changed, they and the Serve Card panes still passed.
    - `docs/protocol/mokly-component-controls.md:69`: no test checks that a
      temporary prop edit stays out of local storage. Separate branch.
      - [x] Follow-up F9b item 3: `serve_temporary_props_status.spec.ts`
            checks that a temporary edit leaves local storage unchanged and
            that a reload shows the saved props. A mutation that stores the
            draft fails it.
    - `packages/viewer/src/shell/README.md`: 451 lines, past the 300-line
      split rule, with no recorded exception. Separate branch.
      - Follow-up F9b item 7, decision 23 for the user: a split by subject
        needs doc-only folders in the source tree or Markdown pages for
        module mechanics, which belong in code comments. Severity Low,
        effort Small. Recommended: A, keep one page, add a heading per
        subject, and record the exception, as decision 2 A did for the
        browser test guide.
    - `packages/viewer/README.md`: 625 lines, past the 300-line split rule,
      with no recorded exception. Separate branch.
      - [x] Follow-up F9b item 7: the README keeps the overview, the quick
            start, a guide list, the responsibilities, and development, in
            285 lines. `docs/concepts`, `docs/api`, `docs/theming`, and
            `docs/deployment` under `packages/viewer` hold the rest, each as
            a `README.md` so that the Markdown link check reads it.
  - [x] M10 D1 round 4 review 1, findings 1, 5 and 6: three ports lacked old
        checks that the current spec requires. Fixed by `303659e9`,
        `4ee66184` and `8409f7b3`. Findings 3 and 4 corrected sweep reasons
        in the round 4 report.
  - [x] M10 D1 round 4 follow-ups in F10, given by the orchestrator on
        2026-10-20, one commit each. Merge decisions:
        `.context/f10/merge-decisions.md`.
    - [x] Review 1 finding 2: each host names the page path that it shows
          for an entry, also the moved-entry hosts. Fixed by `7ca03620` (C).
    - [x] Review 1 finding 7: the Details specs share one copy and reader
          module. Fixed by `7e27fefe` (B).
    - [x] Review 1 finding 8: the UI specs read the Changes count from the
          index. Fixed by `d85e581c` (A).
    - [x] Review 1 finding 9: the default copy's key is `similarTextPage`.
          Fixed by `7c761873` (A).
    - [x] Review 2 finding 10: the wrapper row's title says "no affected
          consumers". Fixed by `c7401d71` (A).
    - [x] Follow-up of review 1 finding 5: `snapshotOf` checks the snapshot
          id format. Done by `054e994d`.
    - [x] Outside-scope item: the CSS evidence pages let a page use
          component elements without usage records. Done by `65179c45`.
  - M10 D1 round 4 decision 11: two PostCSS evidence tests fail on the Node
    22.14.0 viewer runner, which has no `module.registerHooks`. Item 60 C on
    `rebuild/ci-gates` raises the floor to 22.15.0. That branch applied it by
    default under the user rule. Until it merges here, these two tests are the
    only accepted failures of this branch's viewer suite.
  - M10 D1 round 4 decision 13 for the user: write each sweep reason from a
    list of the old test's assertions, and check each port's title. Severity
    Low, effort Small. Covers findings 3 to 6 of review 1 and finding 10
    of review 2. Recommended: A, add the step to the gap sweep procedure.
  - Outside integration batch 6: `tests/browser/shell_client_routes.spec.ts:81`,
    "Back and Forward restore each route's stage scroll", expected 120 but
    received 0, then passed all five isolated repeats. Suspected source:
    scripted scroll races history persistence. Separate branch.
    Evidence: `.context/integration-6/scroll-flake.md`.
    - [x] Resolve in F6 by waiting for each scripted position in history state
          before navigation. Retain every offset and route assertion.
          Evidence: `.context/f6/report.md`.
  - [x] Resolve F7's watched-update disclosure flake. Wait for unfiltered folder
        clicks to save their choice before the next action. Keep all assertions
        and the filter's pre-search baseline. Evidence: `.context/f7/report.md`.
  - [x] Fix F7 review 1: record folder and section choices during activation,
        so a delayed native toggle cannot put the close after search. Keep
        native fallback behavior and a controlled mouse/keyboard regression.
        Evidence: `.context/f7/post-push-review.md` and `.context/f7/report.md`.
  - [x] Resolve the inherited M14 input fingerprint replay flake
        `installing_bindings_on_a_fresh_worker_replays_describe_first`.
        Fixed by `9962e08c`, which seeds the shared fixture's generation epoch.
        All four replay tests passed 50 isolated runs on the merged tree.
        Evidence: M14 `report-6.md` and `fingerprints-final-replays.json`.
  - [x] Resolve the inherited M14 fingerprint review replay flake
        `retired_postcss_contexts_are_disposed_without_resetting_live_contexts`.
        Fixed by `9962e08c`. The same 50 isolated runs passed all 200 cases.
        Evidence: M14 `report-6.md` and `fingerprints-final-replays.json`.
  - [x] Milestone 13 integration follow-up: resolve the full example's CSS-module
        startup failure so strict build and `npm run dev` smoke checks pass.
        Evidence: `.context/rust-rebuild/delegation/m8-core/report-6.md` and
        `.context/rust-rebuild/m8-css-modules-smoke/`.
  - Milestone 13 review 2 follow-up: CI evidence selection compares a literal
    workflow path in `evidence_contract.mjs`; review numeric workflow identity
    matching so a GitHub `path` ending in `@main` can select valid evidence.
  - Milestone 13 review 1, finding 5: the user must settle the Release Please
    component for core-only commits; keep the `packages/mokly` layout until
    that decision. Native builds and paired-tag publication remain unchanged.
  - Milestone 6 review 2, finding 6: settled by F8 decision 21 B. Keep all
    Used by lists unavailable after one unavailable view until the next generation.
  - M8 sidecar review D2: settled by F8 decision 12 C. The wrapper uses the
    viewer profile pre-check, and Rust rechecks every returned instance.
  - Milestone 9 part 2 review 3, finding 2: settle dependency selection for
    HTML-only catalogues that import package CSS; retain working dependencies
    until the user decides.
  - M8 core review 3, finding 2, and review 6, finding 7: settle saved-prop
    control bounds and declared steps that conflict with schema multiples or
    integer values. Keep the current validation until the user decides.
  - Milestone 9 part 1 review 1, finding 11: settled by F8 decision 10 A now,
    with pnpm and Yarn support under option B required before the first release.
  - Milestone 9 part 1 review 1, finding 12: user decision pending on checkout
    conversion for base render/resource bytes; retain raw Git blob bytes.
  - `crates/mokly-compare/src/projection_context.rs:24-38` builds its own
    component counterpart map next to `Lookup::counterpart`. Separate branch.
  - `crates/mokly-compare/src/review_projection.rs:73-82` attaches variants
    through the kind-less `Pairing::paths` map next to `Lookup::parent`. Separate branch.
  - Milestone 12 static review 3, finding 4: the packed native binary scan for
    `MOKLY_TEST_` needs user approval for a new gate. The module-erasure test
    checks only compiler exclusion of the debug fault module.
  - Milestone 12 static review 2, finding 6: settle forced build exit during
    install, rollback, and cleanup. Keep the current forced exit until decided.
  - Milestone 12 publish review 1, finding 8: decide the TLS trust-root policy;
    keep the OS trust store until the user decides.
  - Milestone 12 publish review 1, finding 13: decide private-directory retention
    after success; keep the existing retention until the user decides.
  - Milestone 5 review 1, finding 5: settled by F8 decision 14 A. Keep declared
    stylesheets bundled as delivery roots and align the pages.
  - Milestone 5 review 2, finding 9: decide unknown attributes on ignore wrappers; keep the current rejection pending the user.
  - Milestone 4: decide how to handle prop numbers that cannot round-trip through JavaScript number spelling.
  - [x] Milestone 4 review 1, finding 10: bound YAML alias expansion at
        1,000,000 nodes per file with `html-front-matter`, before any copy.
        Decision: item 7 option A, applied by default (user rule), 2026-10-20.
  - Milestone 7 review 1, finding 12: settled by F8 decision 13 A. Delete the
    unused former catalogue fixtures and their `.prettierignore` entries.
  - Milestone 5: `{{ name }}` with inner spaces settled by Decision 39 on
    2026-10-15. `.prettierrc.json` stays: Prettier's Angular parser rewrites
    `{{open-seats}}` to `{{ open - seats }}` and stops on a literal `{`.
  - Milestone 5: settled on 2026-10-15; the example drops its `watch.rules`
    reload rule, which had no effect.
  - Milestone 8 example port review 1: the Milestone 10 TODO that makes the
    viewer follow the settled design copy changes the viewer's presentation.
    Settled on 2026-10-20 by decision log item 17 A, applied by default (user
    rule): the copy, the states, and the mockup's field rows are approved.
  - Milestone 8 example port review 1, finding 6: settled by F8 decision 18 B.
    Keep the documented own-entry view without caller slot content.
  - Milestone 8 example port review 2, finding 9: settled on 2026-10-16. The
    design links page is three pages within the 250-line limit, its cap is
    gone, and its retry link opens the exact paragraph.
  - Example visual check (report 6), open findings for the user:
    1. Use-case steps ignore the mobile layout. Severity Medium, effort
       Medium. Settled on 2026-10-20 by decision log item 24 A, applied by
       default (user rule): the shell shows each step's mobile view in a
       phone frame below 760px, as the use-case mockup does, and
       `mokly-shell-device-chrome.md` follows.
    2. Desktop component canvas width differs. Severity Low, effort Small.
       Settled on 2026-10-20 by decision log item 25 B, applied by default
       (user rule): the component design and the mockups adopt the shell's
       fixed 1024px desktop canvas.
    3. The shell stub declares no icon. Severity Low, effort Small. Settled
       at `da23c1ce`: the stub declares the packaged Browse icon, so no
       `/favicon.ico` request fails, and the packed smoke has no icon
       allowance.
  - Decision log item 32 follow-ups for the user, raised on 2026-10-20:
    1. A screen or component that only changed components affect offers no
       comparison in the shell. Severity Medium, effort Medium. Its entry
       detail marks it comparison-eligible and the static build writes both
       snapshots, but the shell hides the band because its own views are
       unchanged. `mokly-component-changes.md` says an Affected screens link
       opens the comparison; `mokly-component-workspace-design.md` says
       Unmodified omits the band. Recommended: B, offer the comparison for
       such an entry, open it from Affected screens, and depict its pane
       heading. Option A keeps the band hidden and corrects the first
       sentence.
    2. A variant of an affected component names no changed components.
       Severity Medium, effort Small. The affected records name the parent
       as the consumer, so `projection_affected.rs` gives `relatedComponents`
       to the parent's detail only. A variant page without a loaded review
       then reads "No changes to this saved view." while its preview changed.
       Recommended: B, also index each record by the variant whose views its
       evidence names. Option A documents that only the parent page explains
       the shared change.
  - Milestone 3 Phase A review 1, finding 16: the publish warning rule needs
    a user decision before Milestone 12.
  - Open from the end-state rewrite of 2026-10-14 (the rewrite reports are
    consolidated here):
  - A: settled by Decision 31 on 2026-10-14.
  - B: settled by Decision 32 on 2026-10-14.
  - C: settled by Decision 31 on 2026-10-14.
  - D: settled by Decision 38 on 2026-10-14.
  - E: settled by the orchestrator's M5 brief and final change request on
    2026-10-15: rewrite guides at their milestones. The viewer README, the
    xtask README, and `AGENTS.md` follow Decision 38.
    The teardown deleted `guides_cli`, `guides_ci`,
    `guides_upload_validation`, and `guides_authoring`, which compared the
    guides with the old CLI and authoring API. `guides_copy`,
    `guides_structure`, and `guides_versions` remain. The guides contract
    requires shipped behaviour. The Milestone 5 task explicitly directs the
    HTML authoring guide rewrite. Continue each later guide at its milestone.
  - F: settled by Decision 36 on 2026-10-14.
  - G: settled on 2026-10-14; the release management page follows the
    seven packages of the release contract.
  - H: settled on 2026-10-14; the components contract states that a
    variant's `slots` maps declared slot names to React nodes.
  - I: settled by Decision 33 on 2026-10-14.
  - J: settled by Decision 37 on 2026-10-14.
  - K: settled by Decision 31 on 2026-10-14.
  - L: settled on 2026-10-14; the sidecar contract reports the module graph
    with its import edges and names the JSX development shim.
  - M: settled by Decision 36 on 2026-10-14.
  - N: settled by Decision 35 on 2026-10-14.
  - O: settled by Decision 36 on 2026-10-14.
  - P: settled on 2026-10-14; the five design pages verify through the
    served example and the browser suite.
  - Q: settled on 2026-10-14; `ci-test-timing.md` is rewritten to the
    end-state suites.
  - R: settled by Decision 36 on 2026-10-14.
  - S: settled on 2026-10-14; the README keeps the Status line and the
    `plans/` directory link only, and the policy names that link.
  - T: settled on 2026-10-14; Milestone 8 restores the browser suite.
  - U: settled by Decision 38 on 2026-10-14.
  - Open from the re-review of commit 9f834234, report under
    `.context/rust-rebuild/review-2026-10-14-rewrite-fix.md`:
  - 1: settled on 2026-10-14; `mokly-frame-adapter.md` carries the Status
    line within its cap.
  - 2: settled by Decision 36 on 2026-10-14.
  - 6: settled on 2026-10-14; the seven lines use the source inventory term
    of the source protection contract and link it.
  - 7: settled on 2026-10-14; the lookup cases feed Rust and browser tests.
  - Open from the review of commit 9a7aa5e2, report under
    `.context/rust-rebuild/review-2026-10-13-nine-decisions.md`:
  - 5: settled on 2026-10-14; the entry props contract excludes a function or
    other non-data value with the `props-not-data` warning, for stories too.
  - Open from the review of commit 1fdf5d95, report under
    `.context/rust-rebuild/review-2026-10-13-shell-delivery.md`:
  - 1 to 6: settled by Decision 27 on 2026-10-14; 7 and 8 by Decision 30.
  - Open from the re-review of commit 62223201, report under
    `.context/rust-rebuild/review-2026-10-13-shell-delivery-fix.md`:
  - 1 and the observation: settled by Decision 30 on 2026-10-14.
  - Open from the review of commit 7cb14ebf, report under
    `.context/rust-rebuild/review-2026-10-14-one-revision.md`:
  - 1, 2, 3, 4, 7, 8, and 9: settled by Decision 30 on 2026-10-14.
  - Open from the review of commit c0f61254, report under
    `.context/rust-rebuild/review-2026-10-14-shell-settled.md`:
  - 2: settled by Decision 34 on 2026-10-14.
  - 4: settled on 2026-10-14; the CSS evidence presentation page reads the
    detail's `rules` and `resources` records only.
  - 9: settled by Decision 36 on 2026-10-14.
  - 11: settled on 2026-10-14; the format inventory page carries the Status
    line.

## Post-merge follow-up (non-blocking)

- [ ] Add a byte-bounded cache of unused compiled recipes, revalidated before
      reuse, under F8 decision 59 option C. Revalidate compiler and resolution
      inputs, and agree the byte budget before implementation. The current
      recipe lifetime stays in force under option A until this work lands.

- [ ] Run the bookfolio catalogue through build, serve, Changes, and watch
      after the user supplies access. The user took it out of the rebuild
      scope on 2026-10-20.

- [ ] Remove the duplicate base render between validation and capture: one
      bounded, ordered collector that keeps aggregate errors, warnings,
      retention order, cancellation, fallback, and all charges (capture
      decision 2, option B; user decision 62, 2026-10-20). Measured on
      2026-10-20: React capture 95 s, of which validation 27 s; 5,790
      JavaScript renders in each pass.

- [ ] Share one verified opaque-asset spool for each Serve generation and
      route, released with its generation, under the M14 Serve budgets (M14
      review 6, finding 5, option B; user decision 61, 2026-10-20).

- [ ] Bring large React usable startup under 5,000 ms
      (compilation cache redesign, decision 57 option A); measured 10.5 s
      on the release build on 2026-10-19.

- [ ] Replace the Intel macOS release runner before GitHub retires its Intel
      images, preserving native build and execution coverage.

- Publish the first 0.x release of the new core: platform packages, viewer,
  then CLI; verify each registry package.
- Reset Mokly Cloud and republish its catalogue with the released CLI.
- Decide on a WebAssembly fallback for platforms without a native package.
