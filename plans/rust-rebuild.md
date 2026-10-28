# Rust Rebuild

Status: Completed. [PR #199](https://github.com/mokly-ai/mokly/pull/199) merged on 2026-10-25.
Created 2026-10-12 with the user's consent. It supersedes the
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
[the protocol page](https://github.com/mokly-ai/mokly/blob/b8defe26801a695fd154095b6209501eca2e983e/docs/protocol/rust-rebuild-procedures.md). Later that day
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
The open follow-ups and the user items that the user deferred on 2026-10-21,
up to user item 189, stay in the post-merge section for the user to decide.

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
    time limit by default; user decision 135 B adds a working-tree and CLI
    opt-in; an impossible install uses the working tree's dependencies with a
    warning.
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
    `mokly-viewer/index.json`, and one entry detail v2 per entry with its
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
    Amended on 2026-10-14 under Decision 27. Amended on 2026-10-20 under
    decision default item 23 B: entry detail v2 replaces v1 and carries the
    control declaration order.
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

**Comparison defaults (2026-10-20, applied by default (user rule)):**

- Orchestrator item 39 B: retain page-wide CSS-in-JS owners. A rule changes
  the page component only with a match outside every nested registered
  instance. This prevents duplicate parent Changes rows without discarding
  trusted owners. Alternatives: A, ownerless sheets; C, per-instance sidecar
  attribution.
- Orchestrator item 40 A, after 39 B: emit per-rule evidence for owned rules.
  A changed owned rule with no match on either side emits no record and
  changes no view. This keeps Details aligned with the rule contract.
  Alternative B retains the direct material path and changes the contract.
  Verification follow-up: unresolved owned rules supply no instance proof;
  the entry record does not invent an affected component without a match.
  Merge owned and ownerless evidence before excluding a document route.
- Orchestrator item 48 B (2026-10-20, applied by default (user rule)): matching
  trees deeper than 512 elements keep changed `:has()` selectors as unresolved
  evidence. A measured 288-byte recursive frame on a 2 MiB worker stack,
  with an eightfold margin, permits 910 levels; round down to 512.
  This prevents deep-page aborts while preserving honest evidence.
  Alternatives: A, retain the gap; C, replace the recursive matcher.

- Orchestrator item 45 B (2026-10-20, applied by default (user rule)): remove
  `review.changed-paths` and the claimed Git changed-path comparison input.
  Keep output exclusions against source capture and resource comparison.
  Keep the independent publish checkout check. The comparison consumes
  rendered sources, so no consumer needs Git path discovery. Alternatives:
  A, retain and rename the span; C, add unused Git discovery.

- Orchestrator item 27 B (2026-10-20, applied by default (user rule)): HTML-only
  catalogues without a renderer or PostCSS use working-tree dependencies for
  package CSS on both sides. Compare dependency identities with Git and emit
  `base-dependencies` when they differ. Strict builds fail on that warning.
  This preserves the no-Node HTML boundary and exposes dependency-only edits.
  Alternatives: A, install base packages; C, prepare a base side when package
  CSS is reached.

- Orchestrator item 37 B (2026-10-20, applied by default (user rule)): write all
  text raw while plaintext mode is active. Formatting clones keep authored
  characters and literal entity spellings. Repeated parsing and serialization
  remain stable. Alternative A preserves escaping but shows different text.

- User decision 74 (2026-10-20): C. Limit HTML dependency identity to the
  manifests and lockfiles beside dependency directories used by the head,
  and their repository ancestors. Read exact paths on both sides. With no
  used directory, read no dependency inputs and emit no warning. Preserve
  the warning text and strict failure. This replaces the repository-wide
  scope of default 27 B. Option A retained that scope and its file limit.
  Option B only skipped catalogues without package stylesheets.
  Evidence: `.context/defaults-engine-deps/`.

- Defaults-engine hub review finding 2 B (2026-10-20, approved): share
  plaintext activation between serialization and metadata repair. Follow
  foreign-content and HTML integration-point parsing so escaped text stays
  inert after an HTML component renders inside SVG or MathML. Option A
  duplicates the rule. Option C also changes `noscript` characters and waits
  for the user.

**Comparison filter follow-up (2026-10-20):**

- User decision 96 (2026-10-20): C. Use physical containment to claim matches
  for owned CSS-in-JS, ownerless head styles, and linked CSS. Supplier input
  ancestry only prevents a nested receiver from taking a supplier's own rule.
  Declared owners claim supplied content inside their physical instance even
  without own-page matches. Ownerless and linked rules require catalogue-wide
  own-page proof; otherwise a match falls back to the entry. Keep decision 73's
  supplier protection, decision 75's shared reducer, and the child-only goal
  of decision 39. Alternatives A and B keep receiver-row errors or separate
  models. C removes that delivery-path difference. Items 97 and 98 remain pending.

- Round 4 scoped universal follow-up (2026-10-20): applied by default (user
  rule). The exact decision 96 Stack selector contains universal terms, which
  the former closed keep list always marked unresolved. Recommended option A
  permits ordinary matching when a selector branch has a positive type, class,
  ID, or attribute outside pseudo-class arguments. Bare universals and global
  selectors stay unresolved. Apply this equally to all CSS sources. Option B
  keeps the old rule and uses explicit item classes in the Stack fixture.
  A implements the requested example. No answer followed the question.

- User decision 107 (2026-10-20): C. Extend the scoped-universal default to
  native nested CSS. A substituted nesting parent counts as an outer anchor
  when every branch has a positive type, class, ID, or attribute anchor.
  Authored `:is()` arguments remain conservative. Linked and head-style
  Stack regressions use the same evidence as the flat selector.

- Defaults-engine round 4 focused re-review finding 3 B (2026-10-20): applied
  by default (user rule). Carry kept own-page stylesheet paths through the
  shared reducer and comparison. Use them for preview states, component
  impact, and dependency reasons. Keep nested ownership records and exact
  instance proof. Option A uses a page-level flag but leaves mixed-source
  dependency errors. B is the complete fix within decisions 96 and 73.
  The two-crate scope grades Large. No answer followed the choice. Items 97
  and 98 remain pending.

- Defaults-engine round 3 finding 3 A (2026-10-20, approved): move observations
  out of pending views and pass the vector into attribution by value. Merge
  rule observations in place without cloning their retained paths. Keep
  per-view owned proof indexes and address candidates until option B is decided.
  Alternative B compacts that state; alternative C measures its retained size.

- Defaults-engine round 3 finding 4 A (2026-10-20, approved): decide every
  raw-text tag from the parser-context namespace returned at element entry.
  Preserve raw text at HTML integration points and escape foreign grafts.
  This shares the namespace rule across all raw-text elements without settling
  the broader parser-driven text-mode decision.

- Defaults-engine round 3 finding 2 B (2026-10-20, approved): confirm the
  predicted plaintext element against the reparsed HTML namespace and repair
  identity. Retry with all text escaped when it does not agree. This covers
  the MathML void-element and ignored nested-form divergences without a new
  rejection. Alternative A repairs one context; structural option C lets the
  parser choose the raw-text point and remains pending with the class decision.

- Defaults-engine round 3 finding 5 B (2026-10-20, approved): preserve the
  rebuild tip's shared physical containment and use a second shared path for
  supplier ancestry, indexed by exact instance key. Linked proof retains only
  physical ancestry. Head proof exposes only its supplier path through the
  private proof reader. Alternative A omits linked copies but retains deep
  per-element input lists. Merge resolutions: `.context/defaults-engine-round3/merge-resolutions.md`.

- User decision 73 (2026-10-20): apply hub finding 1 C. Owned rules use
  linked-CSS catalogue-wide own-page proof. A different nested component takes
  a match only when its unfiltered own-page set for the same rule is nonempty.
  Self-nested copies keep their matches. Slots retain supplier input ownership.
  Equal identities join across document owners. This preserves parent edits
  without duplicate child-only consumer rows. Alternatives A, B, and D retain
  lost cases, fix only slots and self-nesting, or remove registry owners.
- User decision 75 (2026-10-20): apply hub finding 5 C. Owned, ownerless head,
  and linked CSS share one evidence reducer for matched, unresolved, and
  excluded records. Build decision 73 on this reducer. This removes delivery
  path drift. Alternatives A and B add the missing record locally or document
  an owned-style exception.
- User decision 76 (2026-10-20): B, implemented in F14 after the shared helper
  landed. Escape raw `</noscript` text inside HTML `noscript`, preserving case.
  Accept the authored-character change to prevent markup activation with
  scripting enabled. Foreign `noscript` keeps ordinary element behavior.
  Reject retaining raw closing sequences in this context.

- Orchestrator item 11 A is the selected default under the user rule.
  Implementation waits for the further decision below. The default requires
  checkout conversion without network access and equality on Git clean form.
  Arbitrary configured Git filters are external programs. Git's transport
  restrictions do not restrict their network access. LFS skip-smudge returns
  a pointer even when a local object exists. The current process boundary
  does not provide portable network isolation.
- Further decision 11.1: offline custom-filter policy. Severity Medium,
  effort Large. Base resources currently compare raw blobs with working
  bytes, so checkout conversion can cause false Changes. Option A supports
  Git's built-in conversions and local LFS objects without running external
  filters; an unsupported custom-filter resource becomes unavailable.
  Option B adds network isolation for arbitrary clean and checkout filters
  on every supported operating system. Both options have Large effort.
  Recommend A: it handles the named line-ending and LFS cases with a clear
  offline guarantee. The new unavailable-resource case needs approval before
  implementation. Keep raw-blob behaviour until this decision is settled.
  Hub review finding 6 A (2026-10-20, approved): dependency identity already
  runs configured Git clean filters for changed manifests and lockfiles via
  `git hash-object --stdin-paths`. The JavaScript base path uses
  `SystemWorkingInputs`; the HTML-only path now calls it from
  `NativeBase::prepare` through `html_dependencies`. Git configuration defines
  executable filter programs; repository attributes can select those configured
  filters. Clean filters can reach the network too. Both options must cover
  dependency identity as well as base-resource checkout conversion. This
  clarification changes no filter execution and does not settle decision 11.1.

**User decision 131 (2026-10-21): keep.** The user keeps every option that
the old default rule applied so far, and reviewed the list. This covers each
line in this plan that says "applied by default" or "the hub's default",
including item 20 C, and the defaults on the unmerged
`rebuild/defaults-engine`, such as items 37 B, 40 A, 45 B, and 48 B. Items 102
and 108 stay open for the user. From 2026-10-21, no default settles an
unanswered decision; only the user's own decisions apply.

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

**Decision defaults (2026-10-20):**

- Item 4 A, applied by default (user rule): publish warnings are fatal only
  with `--strict`. Reject always-fatal warnings so recoverable authoring
  warnings do not block publication. Align the publish and exit-status guides.
- Item 16 B, applied by default (user rule): unknown attributes on ignore
  wrappers warn and are ignored. `--strict` turns the warning into a failure.
  Reject unconditional failure and silent ignoring to catch spelling errors
  while keeping recoverable input usable.
- Item 8 A, applied by default (user rule): publish trusts bundled Mozilla
  roots in addition to the operating system certificate store. Reject OS-only
  trust so minimal containers can publish through public HTTPS endpoints.
- Item 22 A and extended A, applied by default (user rule): keep bounds checks
  on complete merged live props. Warn on saved props or story args outside
  those bounds. Story hints affect controls and live validation, not schemas.
  Reject override-only validation and fatal saved-value bounds checks.
  Fail declared steps that are not schema multiples or are fractional for
  integer props, so controls cannot offer values the schema rejects.
- Item 6 C, applied by default (user rule): round unsafe integer props to the
  nearest binary64 value with a warning before validation and rendering.
  The core and viewer keep the same value. Reject unconditional failure and
  silent rounding to keep recoverable input usable and the precision loss visible.
- Item 9 A, applied by default (user rule): delete exactly the private build
  snapshot after success, including an already-published response. Preserve
  failed-upload snapshots and unrelated files. Cleanup failure warns without
  changing the accepted publication. Reject retaining every successful snapshot
  because it leaves unused output behind.
- Item 30 A, applied by default (user rule): defer a forced second Ctrl+C
  exit while output installation, restoration, or cleanup settles. Exit once
  that operation finishes without another signal. Reject immediate exit in
  these operations because it can strand the earlier site in a backup.
- User decision 86 (2026-10-20): D. Successful and already-published outcomes
  delete the whole private directory created by publish, including its site
  and reservation locks. Use its allocated path held in memory and do not
  follow symbolic links. Failed or cancelled uploads retain the whole directory.
  Cleanup failure warns with that path and keeps publication successful.
  This replaces item 9 A's snapshot-only cleanup, which retained lock directories.
  Evidence: `.context/publish-cleanup/`.
  Merge decisions: `.context/publish-cleanup/merge-decisions.md`.
- Item 23 B, applied by default (user rule): preserve control declaration
  order in entry detail v2 and show that order in the viewer. Explicit controls
  use their declaration order. Derived controls use schema property order or
  first-seen inferred prop order. Reject key sorting because author order
  communicates the intended editing sequence. Regenerate the shared types.

**Decision 6 C clarification (user, 2026-10-20):** The M4 option covers every
authored number, including props and schema keywords. Close N1 under 6 C.
Round unsafe YAML integers before schema validation and warn for schema
keywords. Numeric choice coercion uses the same rounded values. This restores
catalogues whose saved props equal an unsafe schema limit. Reject exact core
keywords and unconditional failure because the core and viewer must agree.
Evidence: `.context/defaults-cli-fix1/finding1-red.log`.

**Hub review of `rebuild/defaults-viewer`, finding 2, requirement applied by
default (user rule), 2026-10-20:** the device chrome contract states that an
expanded frame that leaves the page collapses, so no scrim stays. The
rejected alternative left the contract silent on that case, which allowed the
scrim defect that the review found.

**User decision 82 (2026-10-20): B.** The user: "it should still be possible
to view the diffs for affected screens, they just don't appear in the changes
list". A screen or component that only changed components affect, whose entry
detail marks it comparison-eligible, offers the comparison band. It stays out
of Changes and keeps its Unmodified status, and an Affected screens link opens
its comparison. The rejected option A kept the band hidden and corrected the
spec sentence that says the link opens the comparison.

**Serve pane heading, requirement applied by default (user rule),
2026-10-20:** a view also says "Components this screen uses changed" when its
usage holds an instance of a changed component that the entry detail's
`relatedComponents` names. The rejected alternative read only records and
`affected` evidence. Serve's selected comparison carries no `affected` records,
so a component's markup change left its affected consumer's views reading "No
changes to this screen" beside a band that offers their comparison.

**User decision 84 (2026-10-21): B.** The Details sentence of an entry that only
changed components affect follows the entry's kind, through the shared entry
wording: "Changed components that this screen uses affect its preview." for a
screen, and "Changed components that this variant uses affect its preview."
for a component and its variants. The replaced sentence, "Shared component
changes affect this preview. This page has no independent entry in Changes.",
named a page, but in Mokly a page is a whole-document page entry. A page has
no usage records, so it never shows the sentence. Item 119, building each
kind's sentences from one noun, stays open, so only this sentence changes.

**User decision 119 (2026-10-21): B.** Each kind of Details entry declares its
nouns in one place in the shared entry wording, and every sentence of the kind
takes its noun from there. So one kind cannot name one thing with two words
again, as component copy did with "saved view" and "variant". A screen's
sentences name the screen, and a whole-document page's sentences name the
page. A component's sentences name the shown entry a variant. Its file list
and the sentences of its own rules name the component, because the CSS
evidence presentation contract names two things there. The visible copy stays
the same. The rejected option A kept each kind's sentences written out
separately.

**User decision 88 (2026-10-21): A.** The Props tab shows its fields only after
the routed entry's detail arrives, because only the detail carries their
declared order. Until then it shows "Loading props…" and no fields, so the
fields never move from the index's name order to the declared order. A failed
detail shows "Props couldn’t be loaded." with Try again, as Usage does. The
rejected option B kept the sorted fallback and stated it in the controls
contract. The rejected option C carried `controlOrder` in the catalogue index,
which makes index v8.

**User decision 71 (2026-10-21): B.** The design reasons spec also finds every
built Browse design whose selected row shows Changed or "· Removed", or whose
title row shows an Added, Changed, or Removed badge, and requires each one in
its reasons list. An added entry's row carries no mark in the designs, so the
title row's badge finds it. Pages, documents, and use cases need no entry,
which the design row's `data-entry-kind` tells. The rejected option A kept the
hand-written list alone, so a new design of a changed screen could leave out
its reasons.

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

**CI timeout approval (user, 2026-10-19, decision 5 = D):** browser shards and
native jobs use 60-minute hang guards. Other jobs keep 30 minutes. The user
chose longer job limits instead of changing the four-shard browser partition.
The guards must allow at least three times each job's typical duration.

**Gate approvals (user, 2026-10-19, decision 2 = A):** enable the Rust advisory
audit, generated-TypeScript byte identity, packed-native `MOKLY_TEST_` scan,
and CI example checks through static HTTP and `file://`. Approve 2 GiB per
comparison cache namespace and 120 seconds for base dependency preparation.
The user chose all six items instead of leaving the checks and bounds pending.
The gates protect dependency security, generated contracts, release binaries,
and portable output. The budget values document the existing bounds.

**Node floor, item 60 option C: applied by default (user rule), 2026-10-20.**
Raise the supported Node floor to 22.15.0. Keep the 24.x range unchanged.
The PostCSS evidence hooks require `module.registerHooks`, available from
22.15.0. Apply the floor to package engines, lockfile, shim, CI, Testbox,
release and verification evidence, and guides. This keeps both evidence
checks active on every supported runtime. Alternatives were A, skip the two
checks below 22.15.0, and B, add a fallback without `registerHooks`.
Evidence: `.context/ci-gates-round2/node-floor-2.log`.

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
design defaults of decision log items 17, 24, 32, 38, and 42 and user decisions
82, 84, and 88;
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
- [x] Confirm the landable pull requests merged: #135, #182, and the test and
      CI housekeeping; the user merges them.
      Ticked on 2026-10-21 in plan bookkeeping pass 3: all four children are
      done.
  - [x] #135: closed unmerged by the user's decision on 2026-10-20, because
        #168 replaced its behaviour.
  - [x] #182: merged on 2026-10-20 as `b19d4433`. It released
        `@mokly/mokly` 0.15.0 and `@mokly/viewer` 0.6.0.
  - [x] #198: merged on 2026-10-20 as `d9f421d1` by the user's decision. CI
        also runs on a manual dispatch for any branch.
  - [x] The test and CI housekeeping pull requests: the user decides each
        open pull request.
        Ticked on 2026-10-21 in plan bookkeeping pass 3: the hub closed #174
        and #197 on 2026-10-21, so no housekeeping pull request is open.
    - [x] User decision 63 (2026-10-20): A. On 2026-10-20 the hub closed
          #136, #153, #158, #186, #187, #188, #189, #190, #192, #194, and
          #196 unmerged, each with a comment that names its replacement.
          #174 waits for user item 66, and #197 waits for user item 65.
    - [x] Resolve user item 65 (triage decision 4): when to take the in-range
          updates and Rust 1.99.0 of #197. Severity Low, effort Small.
          Options: A, close #197 and redo the updates after the rebuild
          merges, Small (estimate); B, redo the in-range updates and Rust
          1.99.0 on the rebuild branch before the final pull request, then
          close #197, Small; C, merge #197 into `main` now, Small (estimate).
          Recommended: B.
      - User decision 65 (2026-10-21): A. The hub closed #197 on 2026-10-21,
        and a post-merge follow-up redoes its updates.
    - [x] Resolve user item 66 (triage decision 5): the test gates of #153
          and #174. #153 adds an empty-test assertion guard, and #174 widens
          the clock lint. Severity Low, effort Small. Options: A, adopt
          neither, and record both as post-merge follow-ups, Small
          (estimate); B, widen the clock lint now to `packages/viewer/tests`
          and three more clock forms, and defer the assertion guard, Small;
          C, port both, Large (estimate). Recommended: B. A stricter lint
          needs the user's approval.
      - User decision 66 (2026-10-21): A. The hub closed #174 on 2026-10-21,
        and two post-merge follow-ups hold the clock lint of #174 and the
        empty-test assertion guard of #153.
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
- [x] Record the gate approvals from the Status section before adding the gates.
      Decision 2 = A on 2026-10-19 approves all six items recorded above.
- [x] After user approval, add `cargo xtask check-generated-types` and the
      Rust advisory audit to the Repository suite and CI.
  - [x] Add the Rust advisory audit to Repository, the daily dependency audit,
        and release verification, including reused CI evidence.
  - [x] Add the generated-TypeScript byte-identity gate.
- [x] Resolve RUSTSEC-2026-0235 with item 58 option B, applied by default (user rule), 2026-10-20.
      Exempt only this advisory in `.cargo/audit.toml`. `lightningcss`
      1.0.0-alpha.72 with `bundler` requires `parcel_sourcemap` 2.1.1 and
      `rkyv` 0.7.46. Mokly never reads or writes source maps. Review by
      2027-01-31 or at the next lightningcss update, whichever comes first.
      Keep every other vulnerability failing. The alternative was a dependency
      repair without a compatible published update. The narrow exception lets
      the audit protect all other dependencies.
      Evidence: `.context/ci-gates-round2/rust-audit-2.log`.
- [x] Resolve RUSTSEC-2026-0382, published 2026-10-20: `rustls-webpki`
      0.103.15 may accept distrusted intermediate certificates. It reaches
      `mokly-publish` through `reqwest` and `rustls`. `Cargo.lock` takes the
      patched 0.103.16 and changes nothing else. The remote repository suite
      failed on it in M14 nesting round 7, 2026-10-20. Integration batch 17,
      CI round 5, native CI round 2, F18, F19, and the pnpm and Yarn base
      install made the same lockfile change on 2026-10-20, and this line
      records all seven.
      Evidence: `.context/m14-nesting/r7/audit-before.txt` and
      `.context/m14-nesting/r7/audit-after.txt`; batch 17:
      `.context/integration-17/security-audit.log` and
      `.context/integration-17/security-publish-tests.log`; CI round 5:
      `.context/ci-shard-balance/webpki-advisory.md`,
      `webpki-dependents.log`, and `webpki-green.log`; F19:
      `.context/f19/repository.log`, `.context/f19/rust-audit-fixed.log`,
      and `.context/f19/publish-tests.log`; pnpm and Yarn base install:
      `.context/base-pnpm-yarn/early-repository.log`. The native CI round 2
      and F18 records named no evidence file.
- [x] Keep the braces audit exception through 2026-11-03 UTC. User decision
      72 (2026-10-20): A. Do not renew or extend the exception, and leave
      `rebuild/audit-braces` unmerged. From 2026-11-04 UTC, the strict audit
      and release checks fail on GHSA-vfj7-8cjw-p6xm. The current latest
      `braces` remains 3.0.3. `metro-file-map` 0.87.1 is available, but the
      locked dev-only path remains `metro-file-map` 0.84.6 through
      `micromatch` 4.0.8, so no update was applied.
  - User decision 72 (2026-10-20), in full: A. The audit exception for
    GHSA-vfj7-8cjw-p6xm ends on 2026-11-03 and is not renewed. From
    2026-11-04 UTC the strict audit and the release checks fail on it; that
    failure is known and accepted. Never add or extend an exception.
- [x] Add manual CI dispatch on the rebuild branch. User decision 5 = B,
      approved 2026-10-20, mirrors the trigger in main PR #198. A selected
      branch runs its own workflow and selects the baseline audit. The
      alternative was to leave manual dispatch unavailable on the rebuild.
      Evidence: `.context/ci-gates-round2/manual-dispatch-checks.log`.
- [x] Apply review 2 findings 1 to 8: isolate xtask builds, preserve LF text,
      cover generated sidecar types and Native commands, align the Testbox
      docs, keep Required CI as an aggregator, and enforce Git's 64 MiB cap.
- [x] Commit.

Merge evidence: `.context/ci-gates-round2/merge-decisions.md`.

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
- [x] Restore the example catalogue, the design catalogue, and a packed
      consumer smoke; run the gap sweep against the old rendering and
      component contracts.
      Ticked on 2026-10-21 in plan bookkeeping pass 1: all six children are
      done. The example is `examples/basic/mokly.config.json`, the design
      catalogue is `examples/basic/specs/design`, and
      `tests/design_catalogue.test.ts` checks the served design catalogue.
      The packed consumer smokes are `scripts/release/smoke_example.mjs`
      (`npm run package:smoke`) and `scripts/release/smoke.mjs`, which
      hosted release check run `39529350934` passed. Gap sweeps:
      `.context/rust-rebuild/sweeps/m8-core.md` and `m9-references.md` there.
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
- [x] Complete browser coverage for copied static output.
      Ticked on 2026-10-21 in plan bookkeeping pass 1: all eleven children
      are done.
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
  - [x] Add continuous `MOKLY_PLAYWRIGHT_FILE_DIR` runs in CI only after the
        user approves the new job. Include the private slot and variant file
        fixture and the design journeys checked by a manual run.
        Ticked on 2026-10-21 in plan bookkeeping pass 1: user decision 2 A
        (2026-10-19) approved the job. The `static-delivery` job of
        `.github/workflows/ci.yml` runs
        `scripts/verification/static-delivery.mjs`, which runs
        `playwright.delivery.config.ts` over static HTTP and then with
        `MOKLY_PLAYWRIGHT_FILE_DIR`. That spec list holds the design journeys
        and `component_fragments.spec.ts`, which builds the private slot and
        variant fixture. The job passed in hosted run `39455750846` at
        `b1f3c86f`, integration batch 14, and runs in every CI run since.
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
- [x] Complete the M8 viewer cases assigned by the browser sweep, including
      route/detail races, frame handoff, live prop edits, and preserved focus.
      Ticked on 2026-10-21 in plan bookkeeping pass 1: all five children are
      done. Browser sweep round 14 has 743 rows: 704 ported, 0 open TODO
      rows, and 39 recorded drops, and every ported row has title proof.
      Specs under `tests/browser`: `shell_client_routes.spec.ts`,
      `shell_client_history.spec.ts`, `browse_navigation.spec.ts`,
      `shell_live_edits.spec.ts`, and `serve_usage_focus.spec.ts`. Hub
      record: `.context/rust-rebuild/delegation/m8-browser/report-14.md`.
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

- [x] Add the design catalogue checks that the verification and adoption
      sections of `mokly-design-components.md`,
      `mokly-design-component-library.md`, `mokly-component-design.md`, and
      `mokly-design-links.md` define.
      Ticked on 2026-10-21 in plan bookkeeping pass 2: all eleven children
      are done.
  - [x] Restore current design artboards, library samples, the frozen screen
        inventory, shared component consumers and ownership, portable links,
        controls, and both viewport layouts through Serve.
  - [x] Portable design links, shared samples, and inspector disclosures
        directly from real `mokly build` output through `file://` URLs are
        checked by a manual run.
  - [x] Add a required CI job that builds the example and runs the portable
        design specs through static HTTP and `file://`. Decision 2 = A on
        2026-10-19 approves this gate. The complete local and remote gates
        run the same delivery checks without changing the four browser shards.
  - [x] Port sweep row `component_fragments.spec.ts:0 [private fixture file:// delivery]`
        into the delivery job, applied by default (user rule), 2026-10-20.
        Build the private slot and variant fixture. Open every saved variant
        through standalone portable links in each viewport and scheme. Disk
        mode uses no HTTP request and the source is removed before navigation.
        Evidence: `.context/ci-gates-round2/private-focused-2.log`.
  - [x] Complete the remaining design checks with their feature owners:
        M8 viewer owns live props; M9/M10 own stylesheet attribution and
        comparison output; M8 browser owns the static build acceptance checks.
        Ticked on 2026-10-21 in plan bookkeeping pass 2. Live props:
        `design_library_props.spec.ts` edits a design library component on
        Serve, unsets and sets an optional prop, resets the saved variant,
        and writes no source file. `component_controls.spec.ts` and
        `static_component_controls.spec.ts` check the editable and the
        published read-only controls. Stylesheet attribution and comparison
        output: the design attribution matrix in
        `crates/mokly-cli/tests/design_attribution_tests.rs`,
        `design_behaviour_tests.rs` there, and the design comparison specs
        `comparison_design.spec.ts`, `design_comparison_*.spec.ts`,
        `design_stylesheet_evidence.spec.ts`, and
        `static_comparison_design.spec.ts`. Static build acceptance: the
        `static_design_*.spec.ts` specs, `review_snapshot_links.spec.ts` for
        the Review snapshot link fallback, and the static delivery job over
        HTTP and `file://`. The specs are under `tests/browser`.
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
  - [x] Add the Changes checks after Milestone 9: the attribution matrix, one
        classification of the nine shared sheets per scenario, the rule
        records and the changed-entry union, and bounded base-side Git
        batching.
        Ticked on 2026-10-21 in plan bookkeeping pass 1. The design
        attribution matrix of the M9 TODO "Add the stylesheet attribution
        tests over the design catalogue" holds the first three parts.
        `end_to_end_planning_batches_are_constant_at_ten_and_forty_screens`
        in `crates/mokly-compare/tests/planning_io_tests.rs` bounds base-side
        Git reads by command count: at most four `cat-file` processes, the
        same at 10 and 40 screens. That test uses a generated catalogue, not
        the design catalogue.
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

- [x] Commit.
  - Every Milestone 8 TODO is done, and its work is merged on the rebuild
    branch. Its last review record, browser review 3 finding 1, closed with
    `cffb0713`.

## Milestone 9: Changes

- [x] Settle further decision 11.1 for default 11 A. Severity Medium, effort
      Large. Recommended A: built-in checkout conversion and local LFS only,
      with unavailable resources for unsupported external filters.
  - Settled by user decision 69 (2026-10-21): C, Git checkout conversion for
    every base source read, which replaces default 11 A. User item 69 is
    engine defaults decision 11.1. `rebuild/git-base-reads` merged as
    `8490e636` in integration batch 25.

- [x] Settle the Git changed-path input with decision default 45 B. Remove
      the misleading timing stage and Git-input wording. Keep output exclusions
      for source capture and resource comparison. Keep publish checkout checks.

- [x] Apply defaults-engine review finding 1, High, option B. Keep owned-rule
      page evidence and exact instance proof in independent result fields.
      Self-nested style changes retain implementation evidence without changing
      the component's own view states.
      Evidence: `.context/defaults-engine/implementation-review-1.md`.
- [x] Apply defaults-engine review finding 2, High, option B. Put own render,
      resource, and owned-rule impact under one unchanged-input condition.
      Saved component and variant prop edits keep Details evidence and direct
      view states without marking unchanged consumers affected.
      Evidence: `.context/defaults-engine/implementation-review-3.md`.
- Outside scope: `tests/sidecar_postcss_loader_evidence.test.ts` and
  `tests/static_postcss_base_evidence.test.ts` require loader hooks absent on
  Node 22.14.0. Both files pass all seven tests on Node 24.21.0. Separate branch.
- Outside scope: `tests/browser/static_deployment.spec.ts:79` matched two
  transient headings during a deployment reload. The second remote gate passed
  the same test. Suspected source: reload ordering. Separate branch.
  - User decision 131 (2026-10-21) confirms 45 B. The code remains on
    `rebuild/defaults-engine` until the hub merges this branch.

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
- [x] Implement tree comparison in `mokly-compare`: ownership regions attached
      at composition,
      ignore regions, materiality on canonical trees, moves, documents, pages,
      affected consumers, and review result v8.
      Ticked on 2026-10-21 in plan bookkeeping pass 1: both children are
      done. Code: `material.rs`, `moves.rs`, `affected.rs`, and
      `review_projection.rs` in `crates/mokly-compare/src`. Tests in
      `crates/mokly-compare/tests`: `engine_tests.rs` for ignored changes,
      moves, documents, and pages, with `move_engine_tests.rs` and
      `impact_engine_tests.rs`. The instance and slot markers are in
      `crates/mokly-html/src/_tests_/fragment_tests.rs`, and the strict
      review v8 reader is in
      `crates/mokly-model/src/_tests_/review_reader_tests.rs`.
  - [x] Implement the HTML comparison engine, strict review v8 and snapshot v4
        readers, metadata, move pairing, and historical records.
  - [x] Resolve variant-only affected identity and actual-instance resource
        proof contracts before closing the engine.
- [x] Implement CSS attribution in `mokly-css`: rule collection, diffing,
      selector matching with the keep list, own-page membership, the inline
      rule for whole-screen React entries, and a content-addressed parsed-CSS
      cache.
  - [x] Implement linked-rule collection, diffing, matching, catalogue-wide
        own-page proof, and a byte-bounded parse cache.
  - [x] Resolve multi-component selector ownership and inline evidence
        addresses. Connect page head styles.
  - [x] Connect sidecar style ownership through the base render provider.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/m9-round8/b-regression-final.log`.
  - [x] Resolve user item 39 (review 6b finding 2): page-wide CSS-in-JS
        sheets are owned by the rendered parent in the code, so a child-only
        rule edit can create a direct parent change. Keep this behaviour until
        the user chooses the ownership rule.
    - Replaced by user decisions 73 C and 96 C of 2026-10-20 and 110 C of
      2026-10-21, which `rebuild/defaults-engine` implements. The decision is
      settled, so the hub had this TODO ticked on 2026-10-21. The code
      reaches the rebuild branch when that branch merges.
  - [x] Resolve user item 40 (review 6b finding 3): owned styles set material
        flags without per-rule records in the code. Consumer-instance matches
        of owned styles also supply implementation proof without those records.
        Keep the approved rule-evidence specification. Decide both evidence
        paths before adding records or changing the documented view-state rule.
    - User decision 131 (2026-10-21) keeps option 40 A, which
      `rebuild/defaults-engine` implements. The decision is settled, so the
      hub had this TODO ticked on 2026-10-21. The code reaches the rebuild
      branch when that branch merges.
  - [x] Resolve user item 110 (review 3 finding 1): React component parents
        get false rows from page-wide registry copies. Severity High, effort
        Large for C. Options: A, keep the behaviour, state it, and add a
        React-parent test that asserts it, so the false rows stay, Small
        (estimate); B, remove the supplier-ancestry condition from the owned
        nested test, so that a receiver whose own pages prove the rule takes
        supplied content, Medium. B changes the supplier rule of decisions 73
        and 96: a parent's own rule for the receiver's children then goes to
        the receiver when the receiver's preview also matches. C, collect
        registry styles per registered instance in the sidecar, with slot
        content under its supplier, so that each rule names the component
        that rendered it, Large. C changes the sidecar, the core, and the
        protocol, and it is the original option C of decision 39. D, merge
        A's documentation now and build C next on its own branch, so the
        false rows stay until C lands, Small now (estimate). Recommended: C,
        because it is the only option that keeps both the goal of 39 B and
        the supplier rule of 73 C.
    - [x] User decision 110 (2026-10-21): C. The sidecar attributes each
          registry rule to the registered component render that injected it. It
          uses render-local styled-components sheet proxies and Emotion cache
          proxies over one root extraction, so rule order and consumer CSS bytes
          stay stable. Slot content uses the supplier's proxy. Component and
          whole-screen renders use the same rule. The comparison, sidecar, and
          membership protocols state this ownership contract. Evidence:
          `tests/sidecar_styles.test.ts` and
          `crates/mokly-cli/tests/changes_registry_ownership_tests.rs`.
    - Ticked on 2026-10-21 in integration batch 25: `rebuild/defaults-engine`
      merged as `6a4dcd30`.
  - [x] Decision 110 round 6 audit: keep original style text and delivery
        grouping; store rule ownership as separate trusted metadata through
        repair and capture. Join owners by adapter identity, including cache
        hits. Do not pair equal selectors by insertion order. This preserves
        served bytes for styled-components, Emotion, and the example catalogue.
        Merge resolutions: `.context/defaults-engine-round6/merge-resolutions.md`.
        Round 5 byte reference and red test:
        `.context/defaults-engine-round6/byte-parity-red.log`.
  - [x] Decision 110 fresh review fixes: retain consumer Emotion caches and
        styled-components context; join dependent keyframe owners on cache
        hits; charge fragment attribution through the shared style accounting.
        Failing regressions and review:
        `.context/defaults-engine-round6/fresh-review.md`,
        `.context/defaults-engine-round6/context-red2.log`, and
        `.context/defaults-engine-round6/metadata-weight-red.log`.
  - [x] Decision 110 re-review finding 4: observe consumer caches and sheets
        as well as root collectors. Inline registry extraction receives all
        users of each adapter identity without changing delivered bytes.
        The shared rule and keyframe cases fail in both orders before the fix.
        Evidence: `.context/defaults-engine-round6/fresh-rereview.md` and
        `.context/defaults-engine-round6/foreign-context-red.log`.
    - Outside the scope: `tests/browser/large_watch.spec.ts`, React journey,
      failed with `Test timeout of 300000ms exceeded` and
      `page.waitForFunction: Test ended` in round 6 gate 4; gate 5 passed
      that command. Suspected source: contention in the combined React watch
      journey; the timing contract accepts rare timeouts. Separate branch.
  - [x] Resolve user item 101 (engine review auto-fix): an HTML component's
        own plaintext page lost its root range after parser repair and
        failed static detail validation. Severity Medium, product bug.
        `rebuild/defaults-engine` fixes it as a review auto-fix in
        `3387f236`, and the fix lands when that branch merges. Tick this TODO
        at that merge.
    - Ticked on 2026-10-21 in integration batch 25: the engine merge
      `6a4dcd30` brings the fix.
  - Every sub-TODO is done. The last ones closed when `rebuild/defaults-engine`
    merged as `6a4dcd30`. Items 97 and 108 moved to the post-merge section.
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
- [x] Implement background classification in Serve, the change snapshot v4,
      and on-demand comparison snapshots and panes.
      Ticked on 2026-10-21 in plan bookkeeping pass 1: every child is done.
      Code: `crates/mokly-cli/src/serve_changes.rs` and
      `crates/mokly-model/src/snapshot.rs`. Tests: `serve_changes_tests.rs`
      and `serve_capture_generation_tests.rs` in
      `crates/mokly-cli/src/_tests_`,
      `crates/mokly-model/src/_tests_/snapshot_reader_tests.rs`, and the
      Serve specs `serve_changes_*.spec.ts` and `serve_comparison_*.spec.ts`
      under `tests/browser`.
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
- [x] Behaviour tests from the captured scenarios, rewritten in the new
      formats; run the gap sweep against the Changes and attribution
      contracts.
      Ticked on 2026-10-21 in plan bookkeeping pass 1: every child is done.
      Tests: `tests/rebuild_behaviour_table.test.ts` and
      `tests/rebuild_behaviour_evidence.test.ts`, over
      `scripts/rebuild/rust-adapter.mjs` and `legacy-adapter.mjs`. Sweeps:
      `.context/rust-rebuild/sweeps/m9-compare.md` and `m9-references.md`
      there.
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
- [x] Port the deferred native Changes browser fixtures in the M8 browser
      sweep: base references, moved/removed entries, comparison requests and
      renewal, and CSS evidence. M9 supplies the fixtures; M10 owns their UI
      assertions. Keep the duplicate component-explorer cases in one suite.
      Ticked on 2026-10-21 in plan bookkeeping pass 1: all three children
      are done.
  - [x] Add one native HTML fixture with five cases in four Serve Changes specs.
        Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m11/serve-changes/engine-native-browser.log`.
  - [x] Supply a shared private Serve comparison fixture with a pinned base,
        moved and removed entries, CSS evidence, watched edits, and base-ref
        moves. Cover readiness, membership, retained bytes, and renewal.
        Evidence: `.context/rust-rebuild/delegation/m8-browser/report-9.md`.
  - [x] Complete the 174-case M9/M10 port in `sweeps/m8-browser.md` and
        `next-assignments.md` item 7b.
        Cold base-source preparation uses real offline builds in
        `tests/static_cold_base_tiers.test.ts` for all three dependency tiers.
        Evidence: `.context/cold-base-tiers/inventory.md` and `.context/cold-base-tiers/`.
        Ticked on 2026-10-21 in plan bookkeeping pass 1: browser sweep round
        14 found no open row. The last three branch-point rows came with F15
        (`06de37d7`), which integration batch 17 merged in `bb78a8f3`. Hub
        record: `.context/rust-rebuild/delegation/m8-browser/report-14.md`.
- [x] Add the stylesheet attribution tests over the design catalogue that
      `mokly-component-design.md` and `mokly-design-component-attribution.md`
      define: the nine shared sheets per scenario, the pinned rendered
      stylesheet links, the exact per-entry rendered-resource and rule
      records, the exact changed-entry union, no affected consumers for
      unresolved shared rules, and the attribution acceptance matrix.
      The matrix runs in the separate optional nightly and manual workflow.
      Evidence: `/home/vercel-sandbox/mokly/.context/rust-rebuild/delegation/m9-compare/report-11.md`.
      Ticked on 2026-10-21 in plan bookkeeping pass 1:
      `design_catalogue_attribution_acceptance_matrix` in
      `crates/mokly-cli/tests/design_attribution_tests.rs` runs the scenarios
      in `crates/mokly-cli/tests/design_support/`. `scopes.rs` pins the
      route scopes of the nine shared sheets and the 69 saved library
      variants, and checks them in every scenario. `shared.rs` checks the
      exact rule records, the exact changed-entry union, and no affected
      consumers for unresolved shared rules. `matrix.rs` holds the
      acceptance matrix. `.github/workflows/design-attribution.yml` runs it
      nightly and on manual dispatch. GitHub runs that workflow only from
      the default branch, so it has no hosted run yet.
  - [x] Decide the CI home of the on-demand design matrix: item 50 option B,
        applied by default (user rule), 2026-10-20. Use a separate optional
        nightly and manual workflow on eight CPUs. Give the job 120 minutes
        and the test process a 90-minute hang guard. Preserve every matrix
        assertion. Alternatives were A, further optimization with uncertain
        results, and C, a smaller fixture with less coverage. The separate job
        gives the full matrix continuous coverage without extending Required CI.
        Evidence: `.context/ci-gates-round2/design-measure-2.log`.
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
- [x] Resolve user item 69 (engine defaults decision 11.1): offline custom
      Git filters for base resources. Default item 11 A needs checkout
      conversion of raw base blobs without network access. Git's transport
      restrictions do not isolate external filter programs. Severity Medium,
      effort Large. Options: A, support Git's built-in conversions and local
      LFS objects without external filters, and make a resource with an
      unsupported custom filter unavailable, Large; B, add network isolation
      for arbitrary clean and checkout filters on every supported operating
      system, Large. Recommended: A, because it covers line endings and LFS
      with a clear offline rule. Raw-blob comparison stays until the user
      decides. `rebuild/defaults-engine` records this decision and is not
      merged yet.
  - [x] User decision 69 (2026-10-21): C. Use Git checkout conversion for every
        base source read and extraction. The private temporary index applies the
        base commit's attributes and the user's filters, including line endings,
        local Git LFS objects, and custom smudge commands. A conversion failure,
        timeout, or bound failure leaves that resource unavailable with a
        warning while other resources continue. Custom filters are not
        network-isolated; their configured Git behaviour is the contract.
  - Ticked on 2026-10-21 in integration batch 25: `rebuild/git-base-reads`
    merged as `8490e636`.
- [x] Resolve user item 127 (integration batch 18 decision 1): blobless
      clones fail comparison base reads. Mokly reads base files with several
      `git cat-file` processes at once. In a blobless partial clone, Git's
      parallel lazy fetches fail, so `mokly build --base` and Serve's
      Changes can fail. Plain Git also failed 3 of 8 parallel readers.
      Severity Medium, effort Medium. Options: A, find the missing base blobs
      first, fetch them in one batch, then read, Medium; B, keep the reads
      and show the recovery fetch command on this failure, Small (estimate);
      C, document that comparisons need a full clone, Small (estimate).
      Recommended: A.
  - [x] User decision 127 (2026-10-21): A. Before base conversion, check all
        requested object ids with lazy fetch disabled. Fetch missing ids through
        the configured promisor remote in one bounded `git fetch --stdin`
        request. A failed fetch reports the remote and the recovery command.
  - Ticked on 2026-10-21 in integration batch 25: `rebuild/git-base-reads`
    merged as `8490e636`.
- [x] Commit.
  - Every Milestone 9 TODO is done, and its work is merged on the rebuild
    branch. The last, further decision 11.1, closed with `8490e636`.

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
- [x] Run the viewer suite against Milestone 9 output.
      Ticked on 2026-10-21 in plan bookkeeping pass 1: both children are
      done. The browser suite runs the comparison specs on copied
      `mokly build --base` output, for example
      `static_comparison_output.spec.ts`, and on Serve Changes in
      `serve_comparison_*.spec.ts`. The complete gate passed on tree
      `02e84b0e`, the tip `d044deaf` of `rebuild/defaults-viewer-82b-fix1`,
      which integration batch 18 merged.
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
The F12 follow-ups, the merges of F10 and F11, and the deployment switch
fix: `.context/rust-rebuild/delegation/m10-d1/report-f12.md`.

- [x] Resolve user item 71 (M10 D1 round 3 decision 1): check every changed
      design automatically. `tests/browser/design_reasons.spec.ts` checks a
      hand-written list of 29 Browse designs, so a new design of a changed
      screen can leave out its reasons and no test fails. Severity Low,
      effort Small. Options: A, keep the hand-written list, Small; B, also
      find every built Browse design whose selected row has a Changed,
      Added, or Removed mark, and require each one in the list, except
      pages, documents, and use cases, Small. Recommended: B, because it
      catches the class of gap that round 3 review 1 found. B is a new
      catalogue-wide check, so it needs the user.
  - User decision 71 (2026-10-21): B. Work: W2.
- [x] Commit.
  - Every Milestone 10 TODO is done, and its work is merged on the rebuild
    branch.

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
- [x] Pass the complete gate on the final commit, push the branch, and report.
      Ticked on 2026-10-21 in plan bookkeeping pass 1: this milestone's
      branch `rebuild/defaults-viewer` (`1bdccfba`) and its fix round
      `rebuild/defaults-viewer-fix1` (`2ccc31d7`) are in the 82 B branch,
      which integration batch 17 merged. The complete gate passed on tree
      `02e84b0e`, the tip `d044deaf` of the 82 B fix round, which batch 18
      merged.

## Milestone 10.3: Affected-only comparisons in the designs

Tags: mockup

- [x] User decision 82 B: depict the comparison band and its pane heading
      on `design/components/states/shared-impact/affected-screen`, which
      Action's Affected screens open in Component with changed styles. Update
      the design inventories and the matrix snapshots. The artboard opens in
      Side by side; the inventories, link expectations, and matrix snapshots
      needed no change, because the artboard keeps its path, its links, and
      its library components.
- [x] Run the mockup check and smoke-test the changed pages through Serve.
      Evidence: `.context/defaults-viewer-82b/` (mockup check log and shots).

## Milestone 10.4: Affected-only comparisons in the viewer

Tags: ui

- [x] User decision 82 B: show the comparison band for a screen or component
      that only changed components affect, when its entry detail marks it
      comparison-eligible. It stays out of Changes and keeps its Unmodified
      status. Cover the static build and Serve.
- [x] Open that comparison from the Affected screens list.
- [x] Head a view that uses a changed component, which the entry detail
      names, with "Components this screen uses changed", so Serve's selected
      comparison heads a component's markup change too. Applied by default;
      see the Serve pane heading record.
- [x] Keep each browser shard within its share limit. This milestone's new
      specs put browser shard 3 one test over its limit, because
      `static_design_library.spec.ts` (150 tests) ended that shard. Each
      design library spec now registers one viewport, and a `_mobile` spec
      beside it registers the other. Evidence:
      `.context/defaults-viewer-82b/shards/`.
- [x] Pass the complete gate on the final commit, push the branch, and report.
      Evidence: `.context/defaults-viewer-82b/gate.log`.

## Milestone 10.5: Shared-impact sentence per kind in the designs

Tags: mockup

- [x] User decision 84 B: word the design copy's shared-component sentence
      for each kind. A screen reads "Changed components that this screen uses
      affect its preview.", and a component and its variants read "Changed
      components that this variant uses affect its preview." A page has no
      such sentence. `design/components/states/shared-impact/affected-screen`
      shows the screen sentence.
- [x] Run the mockup check and smoke-test the changed page through Serve.
      Evidence: `.context/viewer-84b/` (mockup check log, smoke log, and
      shots).

## Milestone 10.6: Shared-impact sentence per kind in the viewer

Tags: ui

- [x] User decision 84 B: end the Details of a screen or a component that
      only changed components affect with the sentence of its kind, from the
      shared entry wording. Update the CSS evidence contracts, the Details
      guide, and the tests. The copy test failed first. Evidence:
      `.context/viewer-84b/` (red and green logs).
- [x] Pass the complete gate on the final commit, push the branch, and report.
      Evidence: `.context/viewer-84b/gate.log`.

## Milestone 10.7: One noun source per kind in the viewer

Tags: ui

The design copy keeps its sentences, so decision 119 B needs no mockup
milestone.

- [x] User decision 119 B: declare each Details kind's nouns once in the
      shared entry wording, and build every sentence of the kind from them.
      The visible copy stays the same. The noun test fails first. Evidence:
      `.context/viewer-119b/` (red and green logs, the copy before and after,
      and the mutation check).
- [x] Pass the complete gate on the final commit, push the branch, and report.
  - The branch merged as `4fe8c160`, with 84 B, after its gate.

## Milestone 10.8: Props pending state in the designs

Tags: mockup

The numbers follow Milestones 10.5 to 10.7 of decisions 84 B and 119 B, which
other branches add.

- [x] User decision 88 A: draw the Props tab while the entry's detail loads,
      "Loading props…" with no fields, and after its load failed, "Props
      couldn’t be loaded." with Try again, in the Loading and recovery gallery.
      Add both strings to the settled controls copy.
- [x] Run the mockup check and smoke-test the new pages through Serve.
      Evidence: `.context/viewer-88a/` (mockup check, design specs, smoke log,
      and shots).

## Milestone 10.9: Props pending state in the viewer

Tags: ui

- [x] User decision 88 A: show the Props fields only after the routed entry's
      detail arrives, with the drawn pending and failed states. The browser
      test fails first. Evidence: `.context/viewer-88a/` (red and green
      logs).
- [x] Pass the complete gate on the final commit, push the branch, and report.
  - The branch merged as `3a3355e3` after its gate.

## Milestone 10.10: Changed designs list their reasons

Tags: mockup

The number follows Milestones 10.5 to 10.9 of decisions 84 B, 119 B, and 88 A,
which other branches add.

- [x] User decision 71 B: mark each design row's entry kind, as the product's
      row does, and make `tests/browser/design_reasons.spec.ts` require a
      reasons entry for every built Browse design of a changed, added, or
      removed entry. A temporary unlisted design fails the check first.
      Evidence: `.context/design-reasons-auto/` (red and green logs).
- [x] Pass the complete gate on the final commit, push the branch, and report.
  - The branch merged as `05af6784` after its gate.

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

- [x] Add pnpm and Yarn base dependency installation before the first release,
      under F8 decision 10 option B. Support offline pnpm 10 through 12, Yarn Classic 1,
      and Yarn Berry 4 with node modules. Keep Plug'n'Play on its typed fallback.
      Match exact manager pins and preserve bounded caches and script suppression.
      Design and verification: `.context/base-pnpm-yarn/`.
      Implementation of default decision 10 B on 2026-10-20 replaces the
      npm-only install limit for these supported manager families.
  - [x] Resolve user item 120 (pnpm and Yarn review finding 6): offline-only
        pnpm and Yarn installs rarely reach tier two. pnpm gets an empty
        private store, Berry reads only a committed `.yarn/cache`, and
        Classic needs a committed mirror. So most repositories fail the
        offline install on every cold run, with no failure cache, and get
        "installation failed". Severity Medium, effort Medium. It is a
        performance finding and a requirement. Options: A, keep offline
        installs, and fall back at once, before the copy, with a specific
        reason, when the lockfile has registry packages and the base has no
        offline data, Medium; B, copy in from the user's existing pnpm store
        or Yarn cache, which conflicts with "no shared package store",
        Large; C, allow registry access as npm does, with scripts off, no git
        protocol, and Berry git and GitHub dependencies kept on the fallback
        tier, a network-access decision, Medium (estimate). Recommended: A.
        C best meets F8 decision 10 B.
    - [x] User decision 120 (2026-10-21): C, for pnpm/Yarn finding 6, offline
          installs rarely reach tier two. pnpm and Yarn base installs use the
          registry that the base and user configuration select, with its
          credentials, as npm base installs do. Scripts, pnpmfile hooks, Git
          transports, and Corepack downloads stay off. Yarn Berry Git and
          GitHub sources fall back. Yarn Classic now reads its project and user
          configuration, with fixed private folders, mirror, and lock file.
          Fix round 2 implements it; the local registry tests are in
          `tests/static_base_registry.test.ts`.
  - [x] Resolve user item 122 (wider fix of pnpm and Yarn review findings 1
        and 2): allowlist Berry dependency protocols. Accept only `npm:`,
        `workspace:`, `file:`, `link:`, `portal:`, `patch:`, and `virtual:`
        resolutions, fall back for every other protocol, such as the `exec:`
        generators, and force off a fixed list of Berry settings that load
        project code. Cached git
        dependencies then stop installing. Effort Medium. It is a wider fix,
        so the hub grades no severity, and it is stricter validation, so it
        needs the user. Options: A, keep only the targeted fixes of findings
        1 and 2, Small (estimate); B, the allowlist and the forced-off
        settings, Medium. Recommended: B.
    - User decision 122 (2026-10-21): A. Keep the targeted fixes of findings
      1 and 2, and add no protocol allowlist: the base commit is an ancestor
      of the current commit, so a base install trusts it as the project's own
      install did. `mokly-base-dependencies.md` states the trust rule and
      which `exec:` generators can still run (`b1604f5b`).
    - Option C: the Yarn 4.14 floor and the `built` fallback from fix round
      2 finding 2.
  - [x] Resolve user item 141 (pnpm and Yarn fix round 2 decision): Yarn can
        send unscoped tokens elsewhere. Severity High, security, effort
        Small. Options: A, document it only, Small (estimate); B, clear
        unscoped Yarn credentials for base installs, Small (estimate); C, B,
        and also fall back when a base `.yarnrc.yml` sets `npmScopes`, Small;
        D, fall back whenever the base configuration selects a registry or a
        scope, Medium. Recommended: C.
    - User decision 141 (2026-10-21): A. Document it: Yarn sends an unscoped
      user token to the registry that the base configuration selects, as the
      project's own install of the base commit does. `mokly-base-dependencies.md`
      states how each manager sends tokens (`b1604f5b`).
  - [x] Resolve user item 142 (pnpm and Yarn fix round 2, outside the
        scope): a base `.npmrc` can choose npm's git program. npm gets the
        base's `git=` setting and no `GIT_ALLOW_PROTOCOL`, so a base with a
        Git dependency can run a committed program. Severity High
        (estimate), security, effort Small. Options: A, pin `git` to the
        absolute program that Mokly resolves, Small (estimate); B, A, and
        also no Git transport for npm base installs, as for pnpm and Yarn
        under 120 C, so npm repositories with Git dependencies get tier
        three, Small; C, fall back when the base npm configuration sets
        `git`, Small (estimate). Recommended: B.
    - User decision 142 (2026-10-21): D, an option that this TODO did not
      list: the base commit's `.npmrc` applies as in the project's own
      install, including its `git` setting, because a base install trusts
      the base commit as that install did. `mokly-base-dependencies.md`
      states it, and it no longer says that npm installs clone no Git
      repository (`b1604f5b`).
  - First pnpm and Yarn review, finding 8 (Low): the branch re-resolved
    `Cargo.lock`. The batch 21 merge keeps the tip's resolutions and adds
    only `percent-encoding` and `yaml-rust2`.

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
- [x] Verify native TLS on macOS and Windows CI. Build all five target
      binaries with a target C toolchain and check `ldd`, `otool -L`, or
      `dumpbin /dependents` for an unintended crypto shared-library dependency.
      User decision 106 (2026-10-20): A. Use a separate contents-read release
      check workflow. Before merge, its push trigger is limited to
      `rebuild/ci-release-check`, so the hub can run it before the workflow is
      present on the default branch. After merge, it also accepts a manual
      dispatch. It has no publication job, OIDC permission, npm environment,
      or secrets.
      Hosted run `39524435515` on commit `776dac2e` passed Linux x64, Linux
      ARM64, macOS ARM64, Intel macOS, and Windows x64. Each archive passed
      native TLS inspection and the packed `MOKLY_TEST_` scan. The five native
      reports identify tree `132fc963`. Evidence is under
      `.context/ci-release-check-round9/hosted/`.
- [x] Reconnect the Node agreement and profile-selector tests to the shim's
      gate and tested versions; compare Testbox with the native CI runtime.
- [x] Dry-run the release scripts locally; the real publication is post-merge.
      Ticked on 2026-10-21 in plan bookkeeping pass 1: both children are
      done. Hosted run `39529350934` of the read-only `release-check.yml`
      (user decision 106 A) passed on `bbe9d12d`, which integration batch 18
      merged. It built the five native targets with TLS inspection, packed
      the seven packages with the `MOKLY_TEST_` scan, rechecked them with
      `--reuse`, and passed the Chromium smoke of authoring, browser, Build,
      and Serve.
  - [x] Run the local steps that need no credentials or registry write against
        a scratch checkout and record the blocked steps.
  - [x] Complete the seven-package pack, reuse, and smoke with all native
        archives from the hosted target builds.
        User decision 106 (2026-10-20): A. The branch workflow builds and
        inspects all five native archives, then runs the existing pack, reuse,
        and smoke scripts for the seven-package set from the same commit.
        Hosted run `39524435515` packed seven reports, rechecked the same seven
        archives with `--reuse`, installed Chromium, and passed the clean
        consumer authoring, browser, Build, and Serve smoke. Its evidence
        upload contains the five native, viewer, and CLI archives.
- [x] Settle Release Please selection for core-only commits: item 20 option C,
      applied by default (user rule), 2026-10-20. Make the CLI the root `.`
      component and remove the `node-workspace` plugin. Core-only changes
      release the CLI and its five native packages. Reuse the pinned published
      viewer archive and verify its earlier immutable source. A new viewer
      releases with the CLI and updates its exact dependency. Alternatives were
      B, require a CLI-directory edit for every core fix, and A, a custom runner.
      The root component gives core fixes normal release selection without a
      redundant viewer version.
  - [x] Fix CI-gates round 2 review finding 1: separate the root release
        component from its named public workspace package in the export audit.
        Preserve the CLI baseline and removal checks after core-only releases.
        Evidence: `.context/ci-gates-round2/review-ratchet-green.log`.
        Release selection evidence: `.context/ci-gates-round2/release-all.log`.
- [x] Apply User decisions 93 (2026-10-21): D, and 92: ignore. Keep the root
      CLI component from item 20 C, and make it the only Release Please
      component. Its extra-files update the viewer package and every lockfile
      edge to the same version. The next release is 0.16.0 for both packages.
      Remove the viewer component, viewer-reuse archive download and source
      check, and publish every package from the one release commit. The root
      changelog is the release history for both packages. The implementation
      is on `rebuild/release-lockstep`. The release and workflow tests pass.
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

- [x] Remove the duplicate base render between validation and capture through
      one bounded, ordered collector. Keep aggregate errors, warnings,
      cancellation, fallback, and every charge and bound. Trims preserve the
      earlier kept routes; skipped or trimmed views use source fallback.
      User decision 62 (2026-10-20): B now, in parallel.
      Move this item from the post-merge follow-up into Milestone 14.
      Evidence: `.context/m14-collector/observations.json`,
      `.context/m14-collector/example-parity.json`, and
      `.context/m14-collector/final-verification.json`.
      Integration: `.context/m14-collector/merge-resolution.md`.
      Follow-up integration: `.context/m14-collector-fix1/merge-resolution.md`.

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

- [x] Obtain user approval for the current 2 GiB per repository cache namespace
      and the shared 120-second dependency preparation allowance before adding
      these values to the timings contract.
  - [x] Record the approved 2 GiB bound for each comparison cache namespace.
        Decision 2 = A on 2026-10-19 preserves the current runtime bound.
  - [x] Record the approved shared 120-second dependency preparation allowance.
        Decision 2 = A on 2026-10-19 covers version discovery and all installs.
- [x] Forward sidecar timing records and add core `sidecar.spawn` and
      `sidecar.recycle` spans under the timings contract.

- [x] Restrict static fingerprints to configured roots, inventoried sources,
      and reached closure files. Measure this boundary under the large fixtures.
  - [x] Verify captured bundle inputs against sidecar module digests before
        document callbacks; retain those baselines through the live recheck.
- [x] Report observed-read evidence for the PostCSS module graph and plugin
      file dependencies, and use it as static fingerprint baselines: record
      the bytes that module evaluation and plugins read through observed
      APIs, and keep explicit incomplete coverage and late opaque baselines
      for other reads. Paths and rereads after a plugin runs cannot establish
      the consumed bytes. Plugin file dependencies outside roots and bundle
      modules without witnesses retain an accepted late baseline.
      User decision 114 (2026-10-21): A. It changes this TODO from exact
      consumed-byte digests to this observed-read guarantee, and it removes
      the immutable generation inputs path, which decision 56 A rejects.
      Ticked on 2026-10-21 in plan bookkeeping pass 3: the observed-read
      children are done. The Read Evidence and Incomplete Coverage sections
      of `docs/protocol/mokly-sidecar-postcss.md` state the guarantee.
      `sidecar_postcss_evidence.test.ts`,
      `sidecar_postcss_module_evidence.test.ts`,
      `sidecar_postcss_loader_evidence.test.ts`,
      `sidecar_postcss_ranges.test.ts`, `sidecar_postcss_streams.test.ts`,
      and `postcss_evidence_ledger.test.ts` under `tests` check it. Stage
      evidence: `.context/rust-rebuild/m14-postcss-read-evidence/` and its
      `-2` and `-3` siblings.
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
  - [x] Start observation before consumer preloads. Preserve transformed provider
        output and record raw reads below the provider. Synthetic bytes and
        providers that bypass observed APIs retain incomplete coverage.
  - [x] Retain scalar, vector, and whole-file descriptor reads as exact byte
        ranges. Track FileHandle, Node streams, and FileHandle web streams.
        Keep unknown or overlapping sequential positions opaque. Verify ranges
        in one streamed pass per path and preserve them through both caches.
  - Moved on 2026-10-21 to the post-merge follow-up for confined inputs, by
    user decision 114 A: native, helper, and worker reads, private
    resolution metadata, unknown descriptor positions, opaque providers and
    options, and unavailable native identity.
  - [x] Retain descriptor-bound file identity and verified resolved names.
        Detect equal-byte replacements and symlink retargets before callbacks
        and installation. Keep helper, worker, and native cursor changes opaque.
        Stage evidence: `.context/rust-rebuild/m14-postcss-read-evidence-2/`.
  - [x] Verify native transitive ESM, CommonJS, JSON, dynamic imports, and
        conditional import/require loading on Node 22.15.0 and 24.21.0.
        The older-runtime ESM gap no longer applies after decision 60 C.
  - [x] Retain known native resolution manifests as late inputs. Public hooks
        do not expose the bytes used by private `exports` and `imports` reads.
        Preserve native resolution and its cache. Do not manufacture read receipts.
  - [x] Resolve user item 114 (W6 decision 1, closure decision M14-PC2,
        proposed 2026-10-20): close this PostCSS evidence item? Observed-read
        evidence now covers every read that JavaScript hooks can see. Reads
        by native addons, helper processes, workers, private Node package
        manifest reads, and synthetic providers stay incomplete. Severity
        High, effort Large for B. Options: A, change the parent acceptance to
        the observed-read guarantee and tick that scope with the recorded
        incomplete coverage, Small; B, keep the full parent open until an
        approved confined-domain design can cover opaque reads, Large.
        Recommended: B, because native reads can still produce CSS from
        bytes that differ from their late baseline. Neither option is
        applied. The user reserved the parent checkbox.
    - User decision 114 (2026-10-21): A. This pass changes and ticks the
      parent TODO, and a post-merge follow-up holds the confined input
      design.
  - [x] Measure cumulative range-ledger growth during repeated Serve-style
        updates. A 1 MiB file read in 4 KiB chunks with unique bytes on every
        update reached 31,426,890 JSON bytes at 400 updates on Node 24.21.0.
        Growth was linear at 78,316 bytes per update and projects a 64 MiB
        response at about 856 updates. Node 22.15.0 reached 7,533,952 bytes
        at 100 updates. Evidence:
        .context/rust-rebuild/m14-postcss-read-evidence-3/ledger-boundary-node24-unique.log,
        ledger-100x1m-4k-fd-node22.log, and
        ledger-100x1m-4k-fd-node24.log.
- [x] Resolve user item 125 (W6 decision, first recorded here as decision
      119, proposed 2026-10-21): the cumulative range ledger can pass the
      existing 64 MiB frame limit. It does not block the merge, because
      only plugins that read files through descriptors or streams in small
      chunks add range witnesses. Severity High, effort Large for B.
      Options: A, add a per-context evidence cap below the frame limit and
      retain an explicit incomplete or late class after the cap, Medium;
      B, send evidence deltas or an out-of-band ledger while keeping each
      frame below 64 MiB, Large; C, keep the current cumulative response and
      document the projected session bound, Small. Recommended: B, because
      it preserves exact evidence for long Serve sessions without changing
      the frame limit. No option is applied.
  - [x] User decision 125 (2026-10-21): D. Keep read evidence for one
        generation. A new generation drops earlier child witnesses while
        static-build input checks remain unchanged. Keep cache hits and core
        input checks valid for the generation that owns their result.
- [x] Resolve user item 117 (W6 review finding 2): module hooks miss
      loader-supplied modules. The preload now registers Mokly's hooks
      first, so a consumer load hook that returns source without
      `nextLoad` hides that module. Contexts with an asynchronous loader
      record no ESM module. Such plugin files get no witness, no path, and
      no late baseline, so the protocol's rule that unobserved reads keep a
      late opaque baseline is not true for them. Severity Low, effort
      Medium. Options: A, state the gap in the protocol and the README,
      Small (estimate); B, register a second, path-only hook set after the
      consumer preloads, as the base did, and state the remaining
      asynchronous-loader gap, Medium; C, record module paths through an
      asynchronous resolve hook and a message port, Large. Recommended: B.
  - [x] User decision 117 (2026-10-21): A now, C after the merge, in parallel
        if possible, but do not block the merge. State the asynchronous-loader
        module-path gap now, and continue the loader-path fix after the merge.
  - Option A merged as `951c666e`, with 118 A. Option C is post-merge work in
    the post-merge section.
- [x] Resolve user item 118 (W6 review finding 3): each file open probes
      identity twice. Every tracked open runs one wasted `fstat`,
      `realpath`, and `stat` probe. Severity Low, effort Small. Performance
      findings wait for the user. Options: A, probe in `opened()` only when
      a whole-file read needs it, and in `begin()` only for unsuppressed
      tickets, Small; B, A and also keep the descriptor's object until the
      descriptor closes, Small (estimate); C, an operation-count test for
      the probes of each read at two sizes, Medium. Recommended: A.
  - [x] User decision 118 (2026-10-21): A. Probe file identity only where a
        read needs it, and add operation-count coverage for one probe per
        tracked read.
  - Completed by `4739f11a`: retain one identity probe per tracked read.

- [x] Port the large fixture generator with HTML and React variants and the
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
  - [x] Run the default full-size watch fixture three times per variant and
        record screen, component, and stylesheet edit-to-reload values with
        medians. HTML completed on the 16 GiB Amazon Linux host with release
        binary, two sidecars, and the 6 GiB safety stop: screen
        4,070.7/5,562.1/5,892.3 ms, median 5,562.1 ms; component
        4,024.2/4,155.3/4,262.7 ms, median 4,155.3 ms; stylesheet
        4,300.5/3,788.7/3,929.3 ms, median 3,929.3 ms. React used the same
        release binary, two sidecars, default deadlines, and a 12,582,912 KiB
        safety stop. React screen values were 11,707.2/8,756.7/9,038.9 ms,
        median 9,038.9 ms; component values were 11,589.0/9,009.8/9,209.7
        ms, median 9,209.7 ms; stylesheet values were 3,601.5/2,587.5/3,012.7
        ms, median 3,012.7 ms. Initial-generation whole-harness peaks were
        3,780,684/4,483,220/4,784,216 KiB. Screen edit peaks were
        5,599,440/5,691,836/5,199,424 KiB. Component edit peaks were
        6,714,816/6,246,476/6,520,948 KiB. Stylesheet edit peaks were
        6,951,776/6,944,100/7,109,928 KiB. The maximum whole-harness peak was
        7,335,216 KiB. The 12 GiB stop did not trigger. Evidence:
        `.context/m14-watch-run/watch-report.json`,
        `.context/m14-watch-run/react12-observations.json`, and raw records
        under `html-1/`, `html-2/`, `html-3/`, `react-1/`, `react-2/`, and
        `react-3/`. Every edit restored its original bytes.
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
        User decision 62 (2026-10-20): B now, in parallel. This later instruction
        supersedes the deferral. The collector must not delay the final pull request.
        Collector follow-up finding 2, option A (2026-10-20): record the
        partial-capture rule that was applied as a default, not explicit approval.
        Inputs arrive in route order. Trims remove the last kept routes first.
        A skipped or trimmed view is not reconsidered and uses source fallback.
        A later view can remain even when an earlier skipped view would fit
        the final capacity. Exact old membership and strict route priority
        are not preserved. Options B, stop retaining after the first skip or
        trim, and C, restore the old rule with final-capacity rerenders, remain
        for the user. No retention rule changes in this follow-up.
        Collector follow-up finding 1, option B (2026-10-20): matched-span
        release observations cover all of `changes.classify`. The React fixture
        has 5,850 views, eight render workers, and two sidecars on one host.
        At `324fcfbb`, family peak RSS was 2,557,532 KiB over 270.069 s.
        With the final collector code at `5107d4ce`, it was 2,014,376 KiB over
        188.282 s. Both use Node 24.21.0 and their matching sidecar sources.
        The baseline peak includes a 1,006,284 KiB esbuild helper before
        capture. The collector peak includes a 702,500 KiB helper.
        The whole classification did not regress in this sample, so option C,
        stopping idle esbuild services after bundling, is not selected.
        These observations set no budget or limit. Method and raw samples:
        `.context/m14-collector-fix1/measurement-method.md` and
        `.context/m14-collector-fix1/observations.json`. Final-commit repeat:
        `.context/m14-collector-fix1/final-analysis.json`.
  - [x] Verify the comparison engine's tree walks after M9 integration.
        Cover recursive `owned_styles::visit`, `owned_style_instances::walk`,
        and `inline_styles::collect` in `mokly-compare`. Also remove the
        per-element copy of enclosing instances in `owned_style_instances::walk`.
  - [x] Resolve rendered-depth recursion in the `selectors` crate's `:has()`
        matching path. Its subtree search uses one native frame per rendered
        tree level. A depth bound or an explicit-stack matcher needs the user's
        decision before implementation (M14 review 5, finding 1).
    - Item 48 B is in the code on the unmerged `rebuild/defaults-engine`
      from an earlier default: matching trees deeper than 512 elements keep
      changed `:has()` selectors as unresolved evidence. User decision 131
      (2026-10-21) keeps it. Tick this TODO when that branch merges.
    - Ticked on 2026-10-21 in integration batch 25: `rebuild/defaults-engine`
      merged as `6a4dcd30`.
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
  - Every sub-TODO is done. The last, the `:has()` depth recursion, was
    ticked in `1b459b51` after `rebuild/defaults-engine` merged as
    `6a4dcd30`.
- [x] Run the fixture and the Mokly Cloud catalogue through build, serve,
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
  - Every sub-TODO is done, with its evidence. The large fixture runs are
    sub-TODOs of the fixture generator TODO above. The last sub-TODO here,
    F8 decision 59 A, was recorded in `834a4024`. The bookfolio run stays
    post-merge.
- [x] Make tree conversion, composition, serialization, destruction, and all
      tree walks iterative; remove dependence on the temporary 64 MiB stacks.
      The M5 memory follow-up removes quadratic ancestor-list retention and
      subtree copies in link controls. Evidence:
      `.context/rust-rebuild/delegation/m5/memory-report.md` and `report-4.md` there.
- [x] Review the `plaintext` re-parse limit: closing tags can become text, so repeated parsing can change the tree (M5 review 2, finding 6).
- [x] Decide whether reconstructed `plaintext` text writes raw characters;
      keep its escaping rules until approved (M14 review 1a finding 1B).
  - Item 37 B is in the code on the unmerged `rebuild/defaults-engine` from
    an earlier default: it writes all text raw while plaintext mode is
    active. User decision 131 (2026-10-21) keeps it. User decision 76 B
    covers the `noscript` case: the unmerged `rebuild/followups-f14` escapes
    raw `noscript` closing text in `4beca842`. Tick this TODO when both
    branches merge.
  - Ticked on 2026-10-21 in integration batch 25: `rebuild/defaults-engine`
    merged as `6a4dcd30` and `rebuild/followups-f14` as `7a14845e`.
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
  - [x] Restore "or remove it" in the advice for an empty wrapper in a
        keyframes name, and make the wrapper table test follow each piece of
        advice to a stylesheet that scopes. Decision: nesting report finding 19
        options A and C, approved by the orchestrator on 2026-10-20.
  - [x] Keep the height of each anchored value in the YAML alias scan, so it
        steps aside at an alias copy that is too deep, and narrow its comment
        to the three places where it steps aside. Decision: nesting report
        finding 20 option B, approved by the orchestrator on 2026-10-20.
  - [x] Let the YAML builder's anchor step alone decide which anchors to
        keep, and build each kept copy after that check, so unaliased anchors
        copy no positions. Decision: nesting report finding 21 option B,
        approved by the orchestrator on 2026-10-20.
  - [x] Fix the open CSS Modules problems from the nesting reviews, each
        with a failing test first: wrappers still open at the end of input,
        wrappers nested in keyframes names, CSS line breaks and character
        columns in diagnostics, statements without a block in a rule list,
        comments before `composes`, and the plain-data limit messages.
        Requested by the orchestrator on 2026-10-20. Only the section-reader
        follow-up for finding 22 stays open, under the review TODO.
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
- [x] Complete the gap sweep: every triage decision is in a spec or recorded
      as an accepted difference for the release note. Done on 2026-10-21.
      Close-out: `.context/rust-rebuild/sweeps/m14-part1.md`, section "Close-out".
- [x] Hub gap sweep audit finding 7: the M14 TODOs for the rendered-depth
      recursion of `:has()` and for the raw characters of reconstructed
      `plaintext` text wait for `rebuild/defaults-engine` to merge. The
      `noscript` case also waits for `rebuild/followups-f14`. User decision
      131 (2026-10-21) keeps their options, so both TODOs wait only for those
      merges. Tick this line when both TODOs are ticked.
  - Both TODOs are ticked in `1b459b51`, after `rebuild/defaults-engine`
    merged as `6a4dcd30` and `rebuild/followups-f14` as `7a14845e`.
- [x] Commit.
  - Every other Milestone 14 TODO is done, and its work is merged on the
    rebuild branch. The last closed with the integration batch 25 merges
    `6a4dcd30`, from `rebuild/defaults-engine`, and `7a14845e`, from
    `rebuild/followups-f14`, ticked in `1b459b51`. Item 98 B and the Git
    opaque-asset measurement moved to the post-merge section on 2026-10-22
    under user decision 147 B.

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
Integration batch 18 decisions: `.context/integration-18-merge-decisions.md`.
Integration batch 19 decisions: `.context/integration-19-merge-decisions.md`.
F2 duplicate-fix reconciliation: `.context/f2-reconcile/merge-decisions.md`.

## Milestone 15: Verification, close-out, and review

Release lockstep completion merge decisions: `.context/release-audit-completion/lockstep-merge.md`.
Audit-filter completion merge decisions: `.context/release-audit-completion/audit-merge.md`.

Defaults-engine round 5 merge resolutions: merged `e620ff06`, then the latest
rebuild tip `24982bb7`, with merge commits.
commit. `crates/mokly-compare/README.md` kept the tip's prepared-base text and
this branch's CSS ownership text. `docs/protocol/mokly-build-warnings.md`
kept both the tip warning rows and the HTML dependency producer row.
`plans/rust-rebuild.md` kept both histories and open decisions. The latest tip's
Node 22.15 floor, RUSTSEC certificate patch, capture collector, and CI changes
stay live. Evidence: `.context/defaults-engine-round5/merge-resolutions.md`
and `.context/defaults-engine-round5/merge-latest.log`.

- [x] Complete user decision 94 A (2026-10-21). Cover all five severity
      thresholds, single and multiple target filters, empty lists, malformed
      lists, and unfiltered reports with or without the approved ignore ID.
      Run the regression against the pre-guard implementation before the
      guarded implementation. Preserve the exception date and locked-version
      checks. Evidence: `.context/release-audit-completion/audit-red.log`,
      `audit-green.log`, and the final check records in that directory.

- [x] Complete user decisions 93 D and 92 ignore (2026-10-21). The root
      component's extra-files update all seven package versions and viewer
      dependency edges. This uses one existing Node updater without a
      workspace plugin or independent viewer version calculation. Source
      metadata retains CLI 0.15.0 and viewer 0.6.0 until the next root release.
      The breaking-change release fixture gives both packages 0.16.0 without
      a manual version edit. This corrects the earlier synchronized-source
      wording without changing published versions. Restore the viewer export
      audit and release-selection regressions. Complete the matching immutable
      viewer tag before native builds, without a checkout or build in that
      write-permission job. Keep source, archive, audit, and publication checks.
      Evidence: `.context/release-audit-completion/`.

- [x] Configure plain actionlint runs (2026-10-21). Declare the five exact
      Blacksmith runner labels in the repository configuration without ignore
      rules. Document the manual command. No tracked invocation uses a label
      ignore pattern, and no gate changes. Evidence:
      `.context/ci-actionlint-config/`.
  - Integration batch 18 decision 2 (2026-10-21): configure the actionlint
    runner labels, so that a plain `actionlint` run needs no label ignore
    rule. `rebuild/ci-actionlint-config` (`2bc59dd2`) holds the work.
    Integration batch 20 merged it, and the record above ticks it.

CLI defaults fix1 merge decisions: `.context/defaults-cli-fix1/final-merge-decisions.md`.

- [x] Merge set. User decision 147 (2026-10-21): B. Milestone 15 starts when
      every entry below is done. Everything else is post-merge work; items
      98 B, 111 C, 115 C, 116 C, and 117 C stay post-merge, as the user
      chose earlier.
  - [x] `rebuild/defaults-engine` with user decision 110 C, and its two
        companion branches: `rebuild/defaults-engine-deps`, with user
        decision 74 C, and `rebuild/followups-f14`, with user decision 76 B.
        They hold work that `main` already has.
        Integration batch 25 merged them as `6a4dcd30`, `bb6928db`, and
        `7a14845e`.
  - [x] Passing hosted macOS and Windows CI, in native CI round 6.
        Hosted run 39740477948 on `9a8b3d9f` passed every job, Native
        macOS and Native Windows included.
  - [x] The answered items in progress: 137 B; 84 B, 119 B, 88 A, and 71 B;
        93 D and 94 A; 69 C and 127 A; the 135 B review auto-fixes; and the
        refresh fix of 140 B.
        Integration batch 24 merged 140 B (`cc887869`), 137 B (`3e33bcb0`),
        84 B and 119 B (`4fe8c160`), 88 A (`3a3355e3`), 71 B (`05af6784`),
        and 93 D and 94 A (`3a391c3c`). Batch 25 merged 69 C and 127 A
        (`8490e636`). Batch 26 merged the 135 B review auto-fixes
        (`f291b10e`).
  - [x] The security items 122, 141, and 142, which the user answered on
        2026-10-21 with 122 A, 141 A, and 142 D, and 145 B, which merged in
        batch 23.

- [x] Final review fixes:
  - [x] Final review R1b finding 1 (High security): lowercase percent
        escapes bypass token redaction. Merged in batch 29 as `91dabae4`.
  - [x] Fix the R1b follow-up (High security, from the fix delegate's own
        review): `SecretMatcher` derives `Debug` and prints the bearer
        token. Merged in batch 30 as `035b94bb`: its `Debug` output is
        `SecretMatcher([redacted])`.
  - [x] Fix final review R1a finding 1 (High security): parent package
        roots can become public files, because `FilePolicy::private` gets
        the raw `../` form. Option B: normalized package roots in
        `ResolvedConfig` for every consumer. Merged in batch 31 as
        `e93c80ac`.

- [x] Fix the failing PR preview check, user item 183 (2026-10-23): C,
      every `base-dependencies` warning stops failing `--strict`. Fixed in
      integration batch 33 by `421d604d`, with the failing tests first in
      `d1dd1fd3`. Evidence: `.context/integration-33/`.

- [x] Patch `ctutils` for RUSTSEC-2026-0385 (2026-10-23), the hub's call
      under user decision 146 C, because the advisory failed the Rust
      audit: `ctutils` 0.4.3 to 0.4.4 in `Cargo.lock`, with no audit
      exception. The pinned `cargo-audit` lock has no `ctutils`. Fixed in
      integration batch 33 by `900be784`. Evidence:
      `.context/integration-33/advisory/`.

- [x] Fix the PR preview file size, user item 187 (2026-10-23): C,
      `review.json` is written without indentation. Fixed in integration
      batch 35 by `860ba222`, with the failing tests first in `9b2dfa16`.
      Evidence: `.context/integration-35/`.

- [x] CI round 6, item 1 (2026-10-20): report the actual number of
      successfully probed Testboxes. The mocked regression checks all seven
      probes, the message before suite execution, and no success message after
      a failed probe or fingerprint. Evidence:
      `.context/ci-probe-diagnostic/probe-red.log` and `probe-green.log`.

- [x] CI round 6, item 2 (2026-10-20): inspect all tracked Cargo locks and
      pinned Cargo tools for RUSTSEC-2026-0382. The workspace already uses
      patched `rustls-webpki` 0.103.16. Pinned `cargo-zigbuild` 0.23.4 has no
      such dependency. Latest released `cargo-audit` 0.22.2 still locks
      vulnerable 0.103.13, and its published dependency graph has 13 advisory
      findings. Keep its released source and checksum pinned, refresh its
      committed tool dependency lock, and build with locked resolution in an
      isolated cache. Keep `kstring` 2.0.2 for Rust 1.95.0 compatibility.
      Do not weaken the existing advisory policy or skip the live workspace
      query on a tool cache hit. Evidence:
      `.context/ci-probe-diagnostic/tool-audit-red.log`,
      `pinned-tool-audit.log`, `candidate-tool-build-compatible.log`,
      and `installer-smoke.log`.
  - Integration batch 18 decision 3 (2026-10-21): this record stays beside
    the RUSTSEC-2026-0382 TODO of Milestone 3. It names the advisory, but it
    records a different change: the lock of the `cargo-audit` tool itself,
    not the workspace `Cargo.lock` patch.

- [x] CI round 5, item 1 (2026-10-20): use measured per-test costs to assign
      all discovered browser specs to four whole-file shards in hosted CI and
      the remote executor. Keep the 1.25 test-count share limit. Use the
      current inventory for membership and a median cost for new specs.
      The assignment target is within 15 percent by duration. Tests check
      assignments and coverage, not elapsed time. Hosted confirmation belongs
      to the hub. Scheduling inputs come from run `39455750846` at `b1f3c86f`.
      Evidence: `.context/ci-shard-balance/partition.json` and
      `.context/ci-shard-balance/shard-green.log`.

- [x] CI round 5, item 2 (2026-10-20): move static HTTP and file delivery
      from browser box 1 to an independent seventh Testbox command. Build
      the source there before delivery. Require all seven command results
      and the same five browser/viewer reports. Keep four browser shards,
      current runner sizes, and the 30-minute Testbox job limit. User item
      100 owns any runner or limit change. Tests cover the new command,
      failure propagation, the all-probes barrier, and per-box cleanup.
      Evidence: `.context/ci-shard-balance/delivery-green-node.log` and
      `.context/ci-shard-balance/delivery-green-rust.log`.

- [x] CI round 5, item 3 (2026-10-20): record hosted and remote duration
      observations against their current guards. These measurements do not
      change a limit, assertion, runner, or test inventory. User item 100
      owns the remaining guard and runner decision.

      Hosted run `39455750846`, commit `b1f3c86f`, observed these job minutes:

      | Job | Observed minutes | Limit minutes | Three times observation |
      | --- | ---: | ---: | ---: |
      | Repository | 24.15 | 30 | 72.45 |
      | Viewer | 11.27 | 30 | 33.80 |
      | Static delivery | 18.88 | 60 | 56.65 |
      | Browser 1 | 18.42 | 60 | 55.25 |
      | Browser 2 | 25.22 | 60 | 75.65 |
      | Browser 3 | 11.50 | 60 | 34.50 |
      | Browser 4 | 19.67 | 60 | 59.00 |

      Repository, Viewer, and Browser 2 lack the required three-times margin.
      The native jobs failed and do not establish successful typical durations.
      The latest previous Node 22 remote run at `a3ede4bd` observed repository
      16.20, viewer 7.16, and browser 1 to 4 at 18.55, 23.70, 9.97, and 9.63
      minutes against 30-minute job guards. Browser 1 included both delivery
      modes. Browser 2 failed in the unrelated React watch test. A prior
      browser-1 command at `3d07196e` ended after 30.55 minutes when Testbox
      reached its job limit. These command observations exclude preparation
      and are not successful gate acceptance.
      The new current-inventory assignments contain 339, 515, 695, and 700 tests
      against a 703-test cap. Estimated test work is 10.258 minutes each,
      with a 0.005-percent maximum/minimum difference. Two new specs use
      the median cost. Hosted confirmation belongs to the hub.
      Evidence, exact trees, source reports, and final remote observations:
      `.context/ci-shard-balance/timings.md`, `partition.json`, and `remote-final.log`.

- [x] CI round 5 measurement follow-up (2026-10-20): calibrate scheduling
      costs with both the hosted per-test observations and remote run
      `20261020T191118Z-972099` at `300c4dae`. Include each report's measured
      fixture overhead in its cost allocation. The first placement passed
      all 2,249 browser tests but missed the 15-percent duration target.
      Its browser command minutes were 20.83, 16.43, 14.04, and 17.36 against
      30-minute Testbox guards. Playwright minutes were 15.90, 13.15, 10.24,
      and 13.88. Viewer passed in 9.75 command minutes. Independent delivery
      passed both 645-case modes in 17.70 command minutes. Repository stopped
      on the new Rust advisory after 6.60 minutes. These command observations
      exclude preparation. The five-report aggregate passed and cleanup left
      zero boxes, but the complete gate failed the repository command.
      Updated assignments contain 445, 649, 641, and 514 tests under the same
      703-test cap. Replaying their test costs gives a 10.9-percent spread for
      the hosted sample and 9.1 percent for the remote sample. These estimates
      require the final run and the hub's hosted measurement for confirmation.
      Evidence: `.context/ci-shard-balance/remote-summary.json`,
      `calibration-candidates.json`, and `calibrated-partition.json`.

- [x] CI round 5 review finding 1B: repair a feasible count-cap overflow
      with deterministic whole-file capacity search. Preserve measured-cost
      placement when it fits. Keep every test and the existing cap failure
      when no valid placement exists. The five-file regression failed before
      the fix and passed afterward. Finding 2A corrects the stale six-Testbox
      responsibility to seven. Evidence: `.context/ci-shard-balance/review.md`,
      `review-cap-red.log`, and `review-cap-green.log`.

- [x] CI round 5 final measurement calibration (2026-10-20): include all
      three successful browser report sets in the mean per-test scheduling
      costs. The complete remote gate at `ec47233e` passed seven commands,
      five reports, and cleanup, but command minutes 15.25, 14.48, 15.98,
      and 21.63 still missed the 15-percent balance target. Shard 4's median
      file duration was 1.31 times its prior sample. Its fixture overhead was
      4.99 minutes, against 2.08 to 2.62 elsewhere. Keep fixture and job times
      as separate observations rather than distributing one box's overhead
      across future file costs. The refreshed assignments have 362, 573, 668,
      and 646 tests under the same 703-test cap. Replaying per-test work gives
      spreads of 8.4, 10.1, and 4.6 percent for the three measured samples.
      Actual hosted acceptance stays with the hub. Evidence:
      `.context/ci-shard-balance/final-calibration.json` and `timings.md`.

- [x] Move the 0.14-era notes in `npm-release-notes.md` and the format note to
      the history page at close-out; retain their links and migration content.
      Commit `05923728` already moved the Publish Checkout, Removed Public
      Options, and Portable Namespace notes there.
  - Done in `ab965a6d`: the four notes that shipped with npm 0.15.0, two from
    each release-notes page, moved word for word to the linked page
    `npm-release-history-0-15.md`, because the history page would pass the
    250-line cap. Stubs and links point to them.

- [x] Resolve user item 100: CI jobs exceed the three-times rule of the CI
      timeout approval. On 2-vCPU Blacksmith runners, Repository took 24.1 of
      its 30 minutes and Viewer took 11.3 of its 30 minutes. Severity Medium,
      effort Small. Options: A, raise the limits to at least three times the
      measured durations, Repository 75 and Viewer 40 minutes, Small; B,
      larger Blacksmith runners for Repository and Viewer, which cost more
      and also shorten the critical path of every pull request, Small
      (estimate); C, split the Repository job into parallel jobs, for
      example Rust tests apart from lint, types, and audits, and keep the
      30-minute limits, Medium. Recommended: B, with A as the safety margin,
      to be confirmed by a second measured run.
  - [x] User decision 100 (2026-10-21): apply option A to the CI job limits
        using the same three hosted repeats. The median job durations are
        Repository 15.92, Viewer 10.63, Static delivery 11.68, and browser
        shards 13.05, 13.42, 12.65, and 13.05 minutes. Repository now has a
        75-minute limit and Viewer 40 minutes. Static delivery and browser jobs
        retain 60 minutes because those guards already exceed three times their
        medians. Native jobs are excluded from the median calculation: Windows
        failed in all three runs and macOS failed in two. Native limits stay at
        60 minutes. Required CI stays at 30 minutes because it was not a suite
        timing sample. Evidence: `.context/ci-timing/hosted-timing.md`.
- [x] Resolve user item 124 (CI round 8 decision 1): how to balance hosted
      browser shards. The same files vary above 15 percent in 208 of 267
      comparisons between two hosted runs, so these data do not separate
      runner noise from cache, fixture, and order effects. Severity Medium,
      effort Small. Options: A, three controlled hosted repeats of one
      commit and assignment, with the median shard times as the target,
      Small; B, a dynamic whole-file queue across the four runners, Large
      (estimate). Recommended: A, because it is the smallest way to separate
      stable costs from run variation. The unmerged
      `rebuild/ci-shard-hosted-2` records the measurements.
  - [x] User decision 124 (2026-10-21): apply option A for CI round 8. Use
        three controlled hosted repeats of commit `cdb32803` with one four-shard
        assignment. The median per-test duration from runs `39581933162`,
        `39586827857`, and `39592076732` now drives the whole-file weights.
        The resulting weighted work is 429429, 429334, 410238, and 402429 ms
        for shards 1 to 4, a 6.71 percent range. The assignment has 342, 493,
        696, and 696 tests under the 696-test cap. Keep the four shards and every
        test. The observed shard job medians are 13.05, 13.42, 12.65, and 13.05
        minutes, a 6.06 percent range. Evidence:
        `.context/ci-timing/hosted-analysis.json` and
        `.context/ci-timing/hosted-timing.md`. These medians are the target from
        the fixed assignment. The new weighted assignment needs hosted
        confirmation after integration.

- [x] Fix the remote stale-native defect found in integration batch 23
      (2026-10-21). The remote command now refreshes every regular copied path
      that differs from its warmup `HEAD` before the first build. Cargo keeps
      warmup artifacts for unchanged paths and rebuilds changed crates. The
      failing temporary-directory test proves a changed Rust source is newer
      than the warmup output without checking elapsed time. Commit `aa950467`.
      The warmup workflow is unchanged. Scratch proof run
      `20261021T201812Z-410273` passed seven commands and five reports at
      scratch commit `6f92b78a`; its viewer report passed the fresh-native
      probe. Final-tree run `20261021T204951Z-417056` hit the accepted 300-second
      React watch guard on browser shard 1. Rerun
      `20261021T212859Z-422364` passed seven commands and five reports.
      Evidence: `.context/remote-fresh-native/`.

- [x] Resolve user item 68 (review 11 finding 1, wider fix C): a plan check
      that fails when a ticked TODO has an open child. Three cases so far:
      m7 review 3 finding 4, the deferred probe under a ticked parent at
      `7cfc4895`, and the plan line that was then at line 2125. Severity Low,
      effort Medium. Options: A, no check, and reviews catch it, Small
      (estimate); B, a Node test next to `tests/markdown_links.test.ts` that
      fails on a ticked item with an open child, Medium. Recommended: B. B
      adds a gate, so it needs the user's approval.
  - User decision 68 (2026-10-21): A. No plan check is added.
- [x] Resolve user item 126 (audit item 5, wider fix C): a check for
      milestone and history words in protocol pages. Three protocol passages
      used plan words against the end-state rule: "Compilation redesign is
      deferred" in `mokly-timings.md`, "Decision 56" and "M14" in
      `mokly-sidecar-postcss.md`, and "remains open" in `mokly-export.md`.
      Severity Low, effort Medium. Options: A, no check, and reviews catch
      them under the documentation skill, Small (estimate); B, a
      repository-suite check that fails on milestone and plan-decision
      references in `docs/protocol`, such as M and a number, "Milestone",
      and plan decision numbers, with an allowlist for real terms, Medium.
      Recommended: B. B is a new lint, so it needs the user.
  - User decision 126 (2026-10-21): A. No check for plan words is added.

- [x] Run the complete gate with both executors on the final tree: local,
      `cargo xtask check --executor local` on Node 24.21.0, and remote,
      `cargo xtask check --executor remote` with `MOKLY_TESTBOX_REF` on Node
      22.15.0. Fix anything either reports until both pass.
  - Integration batch 31; evidence: `.context/integration-31/final-gate/`.
  - Every earlier round and batch runs one complete gate with one executor
    (user, 2026-10-21).
- [x] Commit and push.
  - Integration batch 31; evidence: `.context/integration-31/final-gate/`.
- [x] Open the pull request. Its description and squash body write `{target}`
      for the package placeholder, justify each merge decision with its paths,
      and record every approved removal.
  - PR #199, opened on 2026-10-22 with the user's yes (user decision 1, A).
  - User decision 2 (2026-10-25): A. The description summarizes the internal
    merge decisions, and each merge commit message keeps its resolutions. No
    index comment is posted.
  - User decision 3 (2026-10-25): B. The release notes override block stays
    in the PR body.

User decision 184 (2026-10-25): A. The hub squash-merges PR #199 when every
check passes on this commit.

- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
  - Ticked on 2026-10-22 in integration batch 32. The final review R1a,
    R1b, R2, and R3 covered `origin/main..11979328`, and batches 29 to 31
    fixed its High findings. A delta review covered `11979328..98fe3b4d`
    without `plans/` and found no High finding. Its probes ran 752 tests of
    the publish, catalogue, graph, static, and compare crates, and mutation
    probes made the new policy, alias, and redaction tests fail. No finding
    has "Auto-fix: yes", so the review-fix rule applies no fix and needs no
    re-review. Evidence: the hub's
    `.context/rust-rebuild/delegation/m15-review/`.
  - Outside the scope:
    `crates/mokly-sidecar/src/_tests_/pool_release_timing_tests.rs`, test
    `cleanup_retirement_keeps_only_the_cause_after_active_or_idle_failure`,
    failed once in the integration batch 32 repository suite at line 90,
    `left: 0` and `right: 1`, so the trace caught no "stopped" event. It
    passed 300 of 300 runs alone and 100 of 100 runs of the whole
    `mokly-sidecar` library tests. Suspected source: shared global state.
    `tracing` caches callsite interest for the whole process, so a test
    that sets a thread-local subscriber can lose an event while parallel
    tests register theirs. Separate branch.
  - [x] Make the static deployment flow test "a removed step that fails
        after another deployment keeps the use case loading" deterministic.
        It failed both integration batch 30 remote gates with a test
        timeout: its click waited for the full page load that the test
        holds until after the click. The test now waits for the click after
        it releases the held load, and keeps every assertion. Fixed in
        `8c4baf1b`. Evidence: `.context/integration-30/flaky/`.
  - [x] Defaults-engine round 4: apply user decision 96 C for shared physical
        CSS ownership, supplier protection, and exact receiver proof. Retain
        the eight requested acceptance groups. Evidence:
        `.context/defaults-engine-round4/`.
  - [x] Defaults-engine round 4 post-push review finding 1: distinguish
        whole-root own-page filtering from declared-instance filtering. An
        outer supplier cannot block a receiver's declared physical claim.
        This applies option B within decision 96. Evidence:
        `.context/defaults-engine-round4/ancestor-cli-red.log`.
  - [x] Defaults-engine round 4 post-push review finding 2: carry functional
        argument context through selector broadening. Argument-local anchors
        cannot enable universal matching. This applies option A within the
        scoped-universal default. Evidence:
        `.context/defaults-engine-round4/arguments-cli-red.log`.
  - [x] Defaults-engine round 4 repeated-receiver regression: retain exact
        instance identity in shared containment links. A receiving copy of a
        supplier component cannot remove an intermediate declared owner's
        rule. This completes decision 96's exact supplier protection.
        Evidence: `.context/defaults-engine-round4/repeated-cli-red.log`.
  - [x] Defaults-engine round 4 focused re-review finding 3 B: separate kept
        own-page CSS source proof from nested ownership records. Preview states
        and dependency reasons use source proof; Details and exact instance
        proof retain the nested record. Evidence:
        `.context/defaults-engine-round4/provenance-cli-red.log` and
        `.context/defaults-engine-round4/provenance-unit-red.log`.
  - [x] Defaults-engine round 5 finding 2 A: validate every raw-text repair
        identity and retry with escaped text on foreign or mismatched tags.
        Evidence: `.context/defaults-engine-round5/raw-text-red.log`.
  - [x] Defaults-engine round 5 finding 3 A: annotate a fresh source tree and
        disable plaintext prediction during the escaped retry. Evidence:
        `.context/defaults-engine-round5/retry-red2.log`.
  - [x] Defaults-engine round 5 finding 5 A: align the three sidecar and
        membership passages with shared ownership and excluded evidence.
  - [x] Defaults-engine round 5 finding 6 B: remove the unread proof owner
        copy and keep proof storage private. Evidence:
        `.context/defaults-engine-round5/proof-owner-green.log`.
  - [x] Defaults-engine round 5 decision 107 C: count an anchored substituted
        nesting parent for scoped universal matching. Linked stylesheet, head
        style, and unit tests pass. Evidence:
        `.context/defaults-engine-round5/nested-unit-red.log` and
        `.context/defaults-engine-round5/linked-styles-red.log`.
  - [x] Defaults-engine round 5 outside-scope move admission defect: use the
        physical owner claim and retain the failing regression. Evidence:
        `.context/defaults-engine-round5/move-admission-red.log`.
  - [x] Defaults-engine round 5 outside-scope selector duplicate scan: use a
        set and retain the 1:4 operation-count regression. Evidence:
        `.context/defaults-engine-round5/selector-cost-red.log`.
  - [x] Defaults-engine round 3 findings 2 B, 3 A, 4 A, 5 B, and 6 A:
        verify predicted plaintext against the parsed element, consume rule
        observations, share raw-text context and containment paths, and align
        the two supplier-ancestry passages. Evidence:
        `.context/defaults-engine-round3/`.
  - [x] Defaults-engine round 3 post-push review finding 1: require the
        predicted plaintext identity in the parsed prefix through its start
        tag, as well as the complete result. Later literal text cannot replace
        an ignored start. This strengthens approved finding 2 B and leaves
        parser-selected text modes pending. Evidence:
        `.context/defaults-engine-round3/plaintext-identity-red.log` and
        `.context/defaults-engine-round3/plaintext-identity-green.log`.
  - [x] Defaults-engine hub review 1, finding 1: apply user decision 73 C
        through catalogue-wide rule proof and supplier input ancestry.
  - [x] Defaults-engine hub review 1, finding 2 C: F14 applies user decision
        76 B through the shared parser context. Guard raw `noscript` closing
        text, including split writes, without changing foreign elements.
        Evidence: `.context/f14/reproduction.md`.
  - [x] Defaults-engine hub review 1, finding 3: scope HTML dependency
        warnings to exact governing paths. User decision 74 selected C.
        Cover unrelated edits, strict lockfile warnings, exact Git commands,
        and a base tree above the old listing limit.
        Evidence: `.context/defaults-engine-deps/`.
  - [x] Keep the virtual dependency parent for secondary package CSS roots
        when the primary installation is absent. The decision 74 port found
        this confinement failure and added a regression before the fix.
        Evidence: `.context/defaults-engine-deps/virtual-parent-red.log`.
  - [x] Fix decision 74 review findings 1 and 2 within option C: bind HTML
        dependency warnings to the current generation's completed bundle
        inputs. Retired Serve imports and failed cache candidates contribute
        no usage. Extensionless stylesheets and cached bundles retain usage.
        Evidence: `.context/defaults-engine-deps/review-red.log` and
        `.context/defaults-engine-deps/serve-observed-red.log`.
  - [x] Defaults-engine hub review 1, finding 5: apply user decision 75 C
        through one reducer for owned, ownerless head, and linked CSS.
  - [x] Defaults-engine round 2 review, finding 1: retain exact supplier
        instance keys with input ancestry. A repeated component path cannot
        select the receiving copy instead of the supplying instance. This
        implements decision 73 without changing its contract. Evidence:
        `.context/defaults-engine-round2/supplier-red.log` and
        `.context/defaults-engine-round2/supplier-integration-green.log`.
  - [x] Item 101 (2026-10-20, approved): keep the own-page root through
        confirmed plaintext repair. Static detail validates and Usage remains
        ready. Preserve raw authored text and the separate noscript policy.
        Do not mark Usage unavailable. The original round 1 smoke is fixed.
        Evidence: `.context/defaults-engine-round4/item101-cli-red.log`.
  - [x] Defaults-engine round 1 post-push review, finding 1: apply foreign
        end-tag rules after a breakout removed the original element. Shared
        parser context closes the surviving matching ancestor and keeps later
        escaped text inert. Evidence: `.context/defaults-engine-round1/foreign-end-red.log`
        and `.context/defaults-engine-round1/foreign-end-green.log`.
  - Follow-up: share a parsed dependency-input model for identity and source validation.
    Effort Large. Covers pnpm/Yarn review finding 2. Previous lockfile-only examples: none found.
    Review and regression evidence: `.context/base-pnpm-yarn/`.
  - [x] Repair hosted pnpm fixture setup after batch 21. Both fixture installers
        explicitly update their lockfiles after manifest edits. The default suite
        also runs the base-manager and cold-tier files with CI and GitHub Actions
        detection enabled. Evidence: `.context/ci-pnpm-fixture-env/`.
  - [x] Fix pnpm/Yarn review findings 1, 2, 3, 4, 5, 9, and 10 with options A.
        Commits: `f0c46adf`, `ed897229`, `5c7ad760`, `24b53562`, `6d62ca8a`,
        `7e6ae9ad`, and `9855feb1`.
  - [x] Complete pnpm/Yarn review findings 1, 3, 5, and 9. The commits above
        fix them only in part. Fix round 2 on `rebuild/base-pnpm-yarn-fix2`
        completes them when it lands: Berry `exec:` sources (finding 1),
        lockfile paths by position (finding 3), bounded workspace pattern
        walks (finding 5), and the nested Berry cache path (finding 9).
        Fix round 2 landed in integration batch 21 (`d650b856`, which merged
        `a3278e13`): `b6af79d7` (finding 1), `def5b7e5` and `f54a5ec7`
        (finding 3), `4beb492f` (finding 5), and `dd51cf24` (finding 9).
  - [x] Report item 40 (2026-10-21): Yarn Classic `file:` and `link:`
        dependency values use their manifest folder, as Classic rewrites
        them. Bare paths and resolutions keep the Classic root, and lockfile
        values keep the lockfile folder. Branch
        `rebuild/base-classic-manifest-paths`.
  - [x] Apply the base-install security review on `rebuild/base-env-secrets`:
        finding 1, a base configuration can read an inherited secret such as
        `MOKLY_TOKEN` through its manager configuration, and finding 2, a Yarn
        Berry `injectEnvironmentFiles` reads a file outside the repository.
        Review and evidence: `.context/review-base-pnpm-yarn/`.
  - [x] User decision 145 (2026-10-21): B, the wider fix of finding 1. Each
        base install starts from an allowed list of environment variables, not
        the inherited environment, so no `MOKLY_` variable and no other
        inherited secret reaches a manager child. The `MOKLY_` prefix rule is
        part of the allowed list. A private registry whose token comes only
        from the environment uses tier three with the install-failed reason.
        Finding 2 sets `YARN_INJECT_ENVIRONMENT_FILES` so Berry reads no base
        environment file. Tests: `tests/static_base_secrets.test.ts`.
  - [x] Git base-read findings 1 and 7: implement the already approved
        decision 69 C with typed unavailable resources and a path-scoped index.
        Independent comparisons continue. No additional product decision is needed.
  - [x] Git base-read findings 2, 3, 5, and 6: bound converted temporary output,
        recognize optional filter failure, forward every Serve runner option,
        and stream digests without an unbounded temporary spool.
  - [x] Git base-read finding 4: align dependency identity text with converted
        source bytes and retained clean object identities.
  - [x] Preserve extraction limits and cancellation after disk-copy writes.
        Keep partial extraction leases transient and invalidate sources when
        effective checkout settings change. External filters rerun per preparation.
  - Git base-read check evidence: `.context/git-base-reads/verification.md`.
    Earlier remote attempts used the wrong workflow ref and Node 22.14.0.
    These attempts are failed checks, not evidence of unrelated product defects.
  - [x] Pin checkout attribute selection despite an inherited `GIT_ATTR_SOURCE`.
        Keep the base commit's attribute rule for byte reads and extraction.
  - [x] Git base-read fresh review finding 1: share the real repository
        conversion context across bytes, digests, and extraction. Use bounded
        raw NUL-framed batches only when checkout conversion is proved to be
        identity. Other files use bounded `cat-file --filters` streams into
        owned temporary files. Relative filters keep their repository context.
  - [x] Git base-read fresh review finding 2: update the opaque-resource README
        to describe checkout conversion and the retained byte bounds.
  - Outside collector review scope: `crates/mokly-compare/src/comparison.rs`
    calls `render_all` in `compare_captured` after `build_prepare` validated
    the head. Evicted head views can compose again. Separate branch.
  - [x] Fix watch review finding 1 with option A: document the 30-minute
        full-size watch liveness exception beside the 60-second default in
        `docs/protocol/mokly-timings.md`. Evidence: commit `1f1b4334` and
        `.context/m14-watch-run/review-final.md`.
  - [x] F16: repair hosted native verification startup. Use portable terminal
        pointers, resolve Windows Node shims at both xtask process boundaries,
        and bypass the checkout cache on non-Linux native runners. Replace
        Linux-only liveness and hand-built file URLs in affected test fixtures.
        Audit: `.context/f16/platform-audit.md`. The hub must rerun macOS and
        Windows native jobs on `rebuild/native-ci-fixes`.
  - [x] Native CI round 2: preserve configuration and output aliases, reject
        rooted authored paths on Windows, and use native path keys in test
        doubles. Keep output and source case aliases private. Keep watch hashes
        portable. Resolve physical paths in temporary-root fixtures.
        Audit and merge decisions: `.context/native-ci-fixes-2/platform-audit.md`
        and `.context/native-ci-fixes-2/merge-decisions.md`.
        The hub must dispatch hosted macOS and Windows Native jobs on
        `rebuild/native-ci-fixes-2`; Linux checks cannot prove those adapters.
  - [x] Native CI round 2 review finding 1: share protected-location checks
        for requested and physical paths. Apply option B so dependency case
        aliases stay private during admission and live rechecks.
  - [x] Native CI round 3: select the host cache folder in the external-cache
        fixture. Retain PostCSS child failures from startup through requests,
        including IPC disconnect and send failure. A later request replaces
        the failed child. Evidence: `.context/native-ci-fixes-3/`.
        The hub must dispatch hosted macOS and Windows CI on
        `rebuild/native-ci-fixes-3`; the Windows design timeout needs that rerun.
  - [x] Native CI round 4: keep valid unusual names on macOS and keep the
        non-UTF-8 filename case on filesystems that support it. Copy the
        repository ignore rules into the design fixture and add PostCSS child
        phase timings to timeout diagnostics. Evidence:
        `.context/native-ci-fixes-4/`. The hub must dispatch hosted macOS and
        Windows CI on `rebuild/native-ci-fixes-4`.
  - [x] Native CI round 5: start Unix commands in new sessions, treat empty
        process groups as stopped, add the last PostCSS module URL to timeout
        diagnostics, and run native workspace tests with `--no-fail-fast`.
        Linux forced-WASI design tests passed, so the Windows configuration
        hang remains open for hosted diagnosis. Evidence:
        `.context/native-ci-fixes-5/`. The hub must dispatch hosted macOS and
        Windows CI on `rebuild/native-ci-fixes-5`.
  - [x] Native CI round 5 follow-up: use the libproc PID count and preserve
        unknown member status as an error. Synchronize the process fixture
        with the deepest child's signal handler. Share the watchdog input
        stream with `node:process` imports to fix the Windows PostCSS hang.
        Keep the 60-second request budget. Remove the temporary diagnostic
        workflow after hosted import and process checks. Updated evidence,
        the correction to the initial ineffective WASI flag probe, and merge
        audits: `.context/native-ci-fixes-5/resume/`.
  - [x] Native CI round 6: merge the batch-25 rebuild tip once, then prove
        hosted macOS and Windows CI on the task branch. Classify and fix the
        remaining Windows dependency, process, render, watch, and snapshot
        failures without weakening their contracts. Evidence:
        `.context/native-ci-fixes-6/`.
    - Continued on 2026-10-22 after the Codex workspace stopped. Merge
      batch 26 (`11979328`) once. Product defect: the Windows cache root
      used the `\\?\` form, and npm failed on it with "Maximum call stack
      size exceeded", so every Windows npm base install fell back. The cache
      root now keeps the plain drive form (`6623df1d`). Test assumptions:
      the Berry path separator, a newline file name, the runner's system
      `core.autocrlf=true`, `\\?\` workspace roots, PostCSS `URL.pathname`
      paths, and a Windows copy of `node_modules`. A temporary Windows probe
      workflow gave fast feedback and is removed. Round 6 closes the five
      round 5 items below.
    - User item 165 in the post-merge section holds the decision that
      round 6 opened.
  - Outside round 5: `mokly-compare/tests/dependencies_tests.rs` and
    `package_roots_tests.rs` returned Fallback instead of Installed on Windows
    before the package-manager merge. Confirm on the merged tree. Separate branch.
  - Outside round 5: `mokly-platform/tests/process_tests.rs` expects a nonzero
    Windows job-close exit, but the hosted child exited zero. Separate branch.
  - Outside round 5: `mokly-render/tests/integration_tests.rs` reported 14
    Windows failures after the design binary. Inspect their native logs. Separate branch.
  - Outside round 5: `mokly-watch/src/_tests_/native_registration_tests.rs`
    expects slash paths. `mokly-watch/tests/native_tests.rs` cannot rename a
    watched ancestor on Windows. Separate branch.
  - Outside round 5: `xtask/src/remote/_tests_/snapshot_runner_tests.rs` unwraps
    a missing Windows command. Three snapshot adapter cases compare CRLF
    checkout bytes with LF fixtures. Separate branch.
  - [x] F17: align remote executable discovery with the shared Node shim
        resolver and Windows native `.exe` names. Keep explicit extensions
        and Unix names. Evidence: `.context/f17/windows-red.log` and
        `.context/f17/xtask.log`. The F16 dependency merge preserves both
        branches without conflicts: `.context/f17/merge-decisions.md`.
  - [x] F17 decision 1: B, applied by default (user rule), 2026-10-20.
        Split React watch into one browser test per edit kind. Keep every
        evidence and restoration check and the existing timeout. HTML keeps
        the complete three-edit journey. Severity Low, effort Small.
        The accumulated React and base compilations can exhaust the test's
        total guard on two CPUs without a missed watcher event. A keeps the
        rare timeout. C adds the deferred compiled-recipe cache from decision 59. B keeps coverage without a larger timeout or a new cache policy.
        Investigation and phase costs: `.context/f17/investigation.md`.
  - [x] User decision 105 (2026-10-20): A, keep the combined React large
        watch test and record the limit. It replaces F17 decision 1 B. F20
        item 1 reverts the split from `a1c8259c`, keeps the 300-second guard,
        and records the accepted exception in `docs/protocol/ci-test-timing.md`.
  - [x] User decision 67 (2026-10-20): A, delete the unused test helpers
        `tests/helpers/watched_events.ts`, `watched_catalogue.ts`,
        `operation_counts.ts`, and `operation_count_cases.ts` with their own
        five tests, and remove the operation counting helper section of
        `docs/protocol/ci-test-timing.md`. Done in F20 item 2. Search record:
        `.context/m10/f20/item2-searches.txt`.
  - [x] F20 item 4, under the user rule of 2026-10-20 that deleting unused
        code needs no permission: the F18 measurement found 47 unused exports
        in `tests/helpers`, `tests/browser`, and `packages/viewer/tests`.
        Item 2 removed five with the watched helpers. Of the other 42, 21
        items are deleted, and 21 keep their declaration without `export`.
        `tests/fixtures` and the export check stay as they are. The wider
        check is item 109 for the user. Search record:
        `.context/m10/f20/item4-searches.txt`.
  - [x] F20 review finding 43, on 2026-10-21: settled by option C as the
        hub's default. User item 109 option B now needs no baseline entries,
        because F20 removed all 47 unused exports.
  - [x] F20 merge of the rebuild tip `24982bb7`, on 2026-10-20: the plan
        keeps both sides' new records. F17's replacement of the remote
        discovery line stays, and user decision 105 settles the tip's React
        watch timeout line. Merge decisions:
        `.context/m10/f20/merge-decisions.md`.
  - [x] F20 review, on 2026-10-21: finding 40 is fixed by option A. The
        timing contract keeps the exception of user decision 105 and its
        reason, without measurements. The measured limit behind the
        decision: on two CPUs the combined React journey takes 185 to 218
        seconds, about 155 of them in twelve JavaScript compilations, and one
        busy process per CPU pushed it past 300 seconds. Evidence:
        `.context/f17/investigation.md`. The full report is
        `.context/m10/f20/review_1.md`.
  - [x] F20 review, on 2026-10-21: finding 41 is fixed by option A. The path
        identity release note says that the viewer data release note lists
        the names that this release removes from `@mokly/viewer/data`.
  - [x] F20 review finding 42, on 2026-10-21: settled by option B as the
        hub's default. The open React large watch timeout line no longer
        says "Separate branch." or names an unproven suspected cause, and its
        checked child stays.
  - F20 review finding 43: settled on 2026-10-21 by option C as the hub's
    default. The record follows the F20 item 4 record.
  - Outside the F20 review scope:
    - `docs/protocol/ci-test-timing.md`: the duration helper section and the
      fixture budget sentence name test helper files and functions, which
      belong in a README. Separate branch.
    - `docs/protocol/npm-release-notes.md`: the viewer data note says that
      its listed names have no public replacement, but the root
      `@mokly/viewer` entry still exports `ComponentControl` and
      `ComponentControlLabel`. Separate branch.
  - [x] F20 re-review, on 2026-10-21: finding 44 is fixed by option A. The
        path identity release note says that the viewer data release note
        lists the 0.15.0 successors of the released types, such as
        `ManifestV10` and `ReviewResultV7`. The full report is
        `.context/m10/f20/review_2.md`.
  - [x] F20 re-review finding 45, on 2026-10-21: settled by option A as the
        hub's default. Options 42 B and 43 C edit only live lines or add a
        new line beside a checked record.
  - Outside the F20 re-review scope:
    - `docs/protocol/npm-release-notes.md`: no note tells
      `@mokly/viewer/data` users to import `ComponentInstanceRecord` and six
      other dropped types from the root `@mokly/viewer` entry, which still
      exports them. Separate branch.
  - [x] Fix CI release checks hub review finding 4 with option A: name read-only
        release preparation as the npm and Rust audit owner in the three
        affected verification documents. Publication uses the checked archives.
        Split the long xtask README's remote reference into a linked page,
        preserving its content and the existing heading anchors.
  - [x] Fix CI release checks hub review finding 5 with option A: state that
        the Rust audit's date and locked-version checks require a reviewed
        script change even when the approved advisory ID is absent.
  - [x] Fix CI release checks hub review finding 6 with option A: state the
        Node floor and excluded Node 24 versions as current product facts.
  - [x] Fix CI release checks hub review finding 7 with option B: run bootstrap
        fixture Git commands with an empty global configuration and system
        configuration disabled. Reuse the shared isolated Git environment.
        Reproduce global commit signing, tag signing, and hooks before the fix.
        Cover system hooks too. Evidence: `.context/ci-release-fixes/finding7-red.log`,
        `finding7-red-repeat.log`, `finding7-red-system.log`, and `finding7-green.log` there.
  - [x] Apply the authorized CI release checks hub hardening: disable credential
        persistence in both native-build checkouts. Cover both checkout actions
        in the existing native release workflow test. Preserve build behavior.
        Evidence: `.context/ci-release-fixes/native-checkout-red.log` and
        `.context/ci-release-fixes/native-checkout-green.log`.
  - [x] Resolve user item 92 (CI release checks hub review finding 1): the
        release PR check can pass on a stale base. Release Please does not
        update an open release PR for a non-releasable commit, and a re-run
        keeps the old merge commit. So a CLI-only release PR can merge with
        viewer source that differs from the viewer tag. Severity Medium,
        effort Small. Options: A, require branches to be up to date before a
        merge to `main`: a branch protection setting that needs a maintainer
        credential, and every pull request then needs an update after `main`
        moves, Small; B, repeat the comparison in `release.yml` before
        preparation: it adds a gate, and the new CLI tag then needs a new
        version, Small (estimate); C, on each push to `main`, run the check
        for the open release PR and post a required status: it needs
        `statuses: write` and adds a gate, Medium. Recommended: A.
    - User decision 92 (2026-10-21): ignore. The finding is closed with no
      change, because user decision 93 D removes the check.
  - [x] Resolve user item 93 (CI release checks hub review finding 2): the
        viewer check compares the wrong file set. It misses viewer build
        inputs outside `packages/viewer`, such as React and React DOM from
        the root lockfile, which bundle into `dist/browser/shell.js`, and
        the root `tsconfig.json`. It also fails on README files that the
        package does not ship. Severity Medium, effort Medium. Options: A,
        also compare the root `tsconfig.json` and skip the Markdown under
        `src`, which still misses the lockfile, Small; B, also fail when the
        resolved packages in the root lockfile changed since the viewer tag,
        Medium; C, build and pack the viewer at the PR head and compare it
        byte for byte with the published viewer archive of the same version,
        which needs a reproducible viewer build and registry access, Medium;
        D, release a new viewer with every CLI release, which changes the
        versioning, Large. Recommended: C.
    - [x] User decisions 93 (2026-10-21): D, and 92: ignore. Keep the CLI root
          component from decision 20 C, and use its Release Please extra-files
          to update the viewer package and every lockfile dependency edge. One
          root release publishes the CLI, five native packages, and viewer with
          one shared version. The separate viewer component and viewer-reuse
          path are removed. Every release builds and publishes a new viewer
          archive. The stale-base release PR check has no purpose under this
          lockstep rule and remains removed. The first synchronized source
          version is 0.15.0, and the next root release updates both packages to
          0.16.0.
  - [x] Resolve user item 94 (CI release checks hub review finding 3): the
        Rust audit guard misses other report filters. It checks only ignored
        advisory IDs, but a severity threshold or a target list in the audit
        configuration also hides advisories. Severity Low, effort Small.
        Options: A, also fail when the effective settings hold a severity
        threshold or a target list, Small; B, state that the guard covers
        only ignored IDs, Small (estimate). Recommended: A. A is a stricter
        validation, so it needs the user.
    - [x] User decision 94 (2026-10-21): apply option A for CI gates hub review
          finding 3. The Rust audit guard rejects any effective severity
          threshold or target architecture or operating system list, in addition
          to rejecting every ignored advisory other than RUSTSEC-2026-0235. The
          alternative was to document that the guard covered ignored IDs only.
          The stricter guard keeps every other vulnerability visible.
  - `.github/workflows/blacksmith-testbox.yml`: its 30-minute job limit stopped
    a healthy Node 22 file-delivery run before report download. Separate branch.
    The hub must decide the Testbox guard before any timeout change.
    Evidence: `.context/ci-release-fixes/testbox-timeout-annotations.json` and
    `.context/ci-release-fixes/remote-floor-final.log`.
  - `tests/browser/large_watch.spec.ts`:
    `large watch delivers browser evidence for react` hit
    `Test timeout of 300000ms exceeded` during the Node 22 remote gate. The
    unchanged isolated Node 22 rerun passed.
    Evidence: `.context/verification-logs/remote/20261020T153816Z-385781/browser-2-of-4.log`
    and `.context/ci-release-fixes/watch-react-rerun.log`.
    - [x] Settled by user decision 105 (2026-10-20): the combined React
          journey keeps its 300-second guard, its rare timeouts are accepted,
          and `docs/protocol/ci-test-timing.md` records the limit.
  - [x] Fix CI gates hub review finding 1 with option A: move the daily Rust
        audit into an independent read-only job. Keep write credentials in the
        npm update job and disable credential persistence in the Rust checkout.
        Evidence: `.context/ci-gates-hub-fixes/f1-green.log`.
  - [x] Fix CI gates hub review finding 5 with option A: overwrite the fixed
        design-attribution evidence artifact on reruns. The wider upload-policy
        check remains a user decision.
  - [x] Fix CI gates hub review finding 6 with option A: align release recovery
        and packing descriptions with an optional new viewer tag and reuse of
        the pinned published viewer archive.
  - [x] Fix CI gates hub review finding 7 with option B: keep the design and
        private-fixture delivery requirement in the protocol. Move the full
        spec list to the browser README, split its comparison reference into
        a linked page, and correct the runtime list's conjunction.
  - [x] Record the available remote timings for CI gates hub review finding 4.
        Two successful samples per runtime give these median command minutes
        for Node 22.15.0 / 24.21.0: repository 13.43 / 11.46, viewer 6.64 /
        5.71, browser shards 1 to 4 respectively 16.99 / 18.77, 14.33 / 15.33,
        8.61 / 8.48, and 8.71 / 8.90. Shard 1 includes both delivery modes.
        Combined delivery test times have medians of 7.45 / 8.15 minutes.
        These proxies exclude Testbox preparation and are not hosted job times.
        The repository proxy exceeds the 10-minute ceiling for its 30-minute
        guard. The local design command took 13.85 minutes on eight CPUs.
        No complete static-delivery, daily Rust audit, or native job sample is
        available. The hub owns hosted measurements after integration.
        Evidence and exact trees: `.context/ci-gates-hub-fixes/timings.md`.
  - [x] User decision 79 (2026-10-20): apply option B for CI gates hub review
        finding 9. Enforce the RUSTSEC-2026-0235 review conditions in the shared
        Rust audit command. Fail after 2027-01-31 UTC, when locked `lightningcss`
        changes from 1.0.0-alpha.72, or when another advisory is ignored.
        Replace the open manual review task with tests for the date boundary,
        dependency versions, effective ignore settings, and command failures.
        The alternative was reminder-only tracking. Keep every other advisory
        failing and retain informational warnings. Evidence:
        `.context/ci-release-checks/decision79-green.log` and
        `.context/ci-release-checks/decision79-smoke.log`.
  - [x] User decision 77 (2026-10-20): apply option B for CI gates hub review
        findings 2 and 3. Reject release PRs that keep a changed viewer's version
        or release the viewer without the CLI. Compare reused viewer source
        with its existing tag, excluding tests. Reject before tags exist instead
        of rejecting publication, relying on commit discipline, or adding a
        viewer-only publish path. Tests cover stale base changes and both valid
        release forms. Evidence: `.context/ci-release-checks/decision77-red.log`
        and `.context/ci-release-checks/decision77-green.log`.
  - [x] User decision 78 (2026-10-20): apply option B for CI gates hub review
        finding 8. Exclude all Node 23 releases from both engine ranges, the
        lockfile, and the shim. Keep the 22.15.0 floor and existing Node 24
        exclusions. Reject the unsupported line before native lookup instead
        of excluding only early Node 23 versions or adding a sidecar failure.
        Align live guides and package docs. Preserve the root README's setup
        and code reference in a linked development guide to keep files short.
        Evidence: `.context/ci-release-checks/decision78-red.log` and
        `.context/ci-release-checks/decision78-green.log`.
  - [x] User decision 81 (2026-10-20): apply option B for CI gates hub review
        finding 1. Move the release Rust audit and all verification, packing,
        and consumer smokes into read-only preparation. Publication requires
        that job and rechecks its exact saved archives. Disable publication
        dependency lifecycle scripts and checkout credential persistence.
        Keep the npm environment and OIDC token only in publication. Use the
        same resolved Node version in both jobs. This removes privileged build
        work instead of leaving complete-gate fallback in the publish job.
        Retain original-run retry selection and immutable archive checks.
        Evidence: `.context/ci-release-checks/decision81-red.log` and
        `.context/ci-release-checks/decision81-green.log`.
  - [x] User decision 80 (2026-10-20): add no upload policy test for CI gates
        hub review finding 5C. Keep the existing design upload overwrite fix
        and the specific release workflow assertions. The alternative was a
        new general policy check for every fixed-name upload. The user chose
        the direct fixes without that additional gate.
  - [x] Keep decision 81's existing shell and toolchain checks on the moved
        preparation workflow. The complete gate exposed the shell test's old
        workflow lookup. Preserve its tagged-commit assertion and include the
        moved steps in the existing npm and Rust pin inventories.
        Evidence: `.context/ci-release-checks/workflow-location-red.log` and
        `.context/ci-release-checks/workflow-location-green.log`.
  - [x] Fix CI-gates review finding 1 with option B: validate delivery reports
        in the parent process. A suppressed reporter failure cannot pass a
        skipped or incomplete run. Keep the real Playwright regression.
        Evidence: `.context/ci-gates/review.md` and
        `.context/ci-gates/review-fix-red.log`.
  - `crates/mokly-sidecar/src/_tests_/pool_release_timing_tests.rs`:
    `cleanup_retirement_keeps_only_the_cause_after_active_or_idle_failure`
    observed zero stop spans instead of one during CI-gates verification.
    Its exact rerun and the full workspace rerun passed. Suspected source:
    concurrent tracing-subscriber capture; not proven. Separate branch.
    Evidence: `.context/ci-gates/repository-remainder.log` and
    `.context/ci-gates/sidecar-rerun.log`.
  - [x] N1: closed by the user's 2026-10-20 clarification of decision 6 C.
        Round every authored number, including schema keywords, with warnings.
  - [x] CLI defaults item 8, fix1 review 3 finding 2: covered by 6 C, confirmed
        by the user on 2026-10-20. Apply option A: warn on unsafe numbers in
        authored control metadata with the existing code, message form, JSON
        pointer form, and duplicate rule. Strict mode treats them like the
        other unsafe-integer warnings. Broader preparation tracking, option B,
        is not selected because the scoped warning producer completes 6 C.
  - User item 85: withdrawn on 2026-10-20, because decision 6 C already
    rounds every authored number, including props and schema keywords. It
    needs no TODO.
  - Item 87: the user still decides final warning text. Keep numeric warning
    text in one formatter so the later wording change needs one edit.
  - [x] User decision 135 (2026-10-21): B. Resolve user item 135. Keep base
        lifecycle scripts disabled by default and adds `review.baseInstallScripts`
        plus `--base-install-scripts` and `--no-base-install-scripts` overrides.
        The setting comes from the working tree only. Scripts-on cache keys add
        Node version and platform, `MOKLY_TOKEN` stays out of installs, and the
        existing process-tree owner stops script children. Evidence is recorded
        under `.context/base-install-scripts/`.
  - [x] User item 135 B review finding 44 A: retain the scripts opt-in hint as
        a separate base diagnostic when build or publish makes Changes
        unavailable, including the comparison-limit path. Capture failures and
        a typed hint field remain outside this fix. Evidence:
        `.context/base-install-scripts-review/`.
  - [x] User item 135 B review finding 50 B: keep script-suppression flags in
        the fixed install lists and remove them only for scripts-on installs.
        Pin every manager's complete scripts-off arguments in tests.
        Evidence: `.context/base-install-scripts-review/`.
  - [x] User item 135 B review finding 48 A: wait for the cancellation
        fixture's child PID through a named pipe. Keep its cancellation and
        child-exit assertions. Evidence: `.context/base-install-scripts-review/`.
  - [x] User item 135 B review finding 46 B: share parent-side Node selection
        with rendering, probe outside the base extraction, and key scripts-on
        installs on Node's version, operating system, and architecture. Put
        the probed executable's folder first on the install PATH while keeping
        the selected manager. Evidence: `.context/base-install-scripts-review/`.
  - [x] User item 135 B review finding 49 A: state the scripts mode in both
        protocol cache-key descriptions. Scripts-on keys also include the
        install Node's version, operating system, and processor architecture.
  - [x] F19: filter ordinary ignore-wrapper attributes at both HTML parsing
        boundaries under decision 16 B. The token boundary keeps warning names,
        reserved-navigation evidence, and duplicate-attribute errors. The
        HTML5 tree sink filters elements before composition or slot routing.
        Remove the replaced consumer filters and keep their regressions.
        This completes the wider fix for CLI defaults review finding 1.
        Evidence: `.context/f19/` and `.context/defaults-cli/review-1.md`.
  - [x] F19 review findings 1 and 2: count warning names once per shared body
        across both wrapper kinds. Preserve wrapper source positions through
        filtering, HTML table repair, and plaintext reparsing with opaque
        source signatures. This completes the authorized parser relocation.
        Evidence: `.context/f19/post-push-review.md` and the review regression logs.
  - Follow-up: carry source identities through HTML5 token processing for all
    elements instead of matching tag signatures. Effort Large. Covers F19
    review finding 2, option B. Previous example: the existing source-location
    queues. The scoped wrapper repair applies option A.
    - User decision 98 (2026-10-21): B, in parallel and non-blocking. Item
      98 now covers this follow-up and F21 review finding 5: one HTML
      pipeline in which html5ever's tree builder reads the tokens of the
      token pass, chooses every text mode, and gives each element its source
      position. Work: W6 on `rebuild/html-pipeline`. It must not delay the
      final pull request.
  - [x] Resolve user item 115 (F19 review finding 1, as the hub numbers it):
        delivered documents lose wrapper-named attributes. The tree sink
        filters every HTML5 parse. So a raw delivered `.html` file, a
        `srcdoc` value, or `definePage` HTML with an element named
        `mokly-ignore` or `mokly-ignore-scope` loses attributes such as
        `style`, `src`, `href`, and `class` in Mokly's tree. The browser
        still applies them, but `definePage` pages lose them in the served
        page. So the public closure can miss a referenced file, and Changes
        can miss a style change in an embedded document. Severity Low,
        effort Large for C. Options: A, accept the global filter and state
        it in the HTML screens protocol, Small (estimate); B, filter only
        authored parses through an authored flag on the parser arena, so
        that two graph scans read the attributes again and widen their cache
        keys, Medium; C, split the public parser into an authored parse and a
        delivered-document parse that every caller chooses, Large.
        Recommended: C.
  - [x] Resolve user item 116 (F19 review finding 3, as the hub numbers it):
        new code can bypass the token boundary. Nothing stops new code in
        `mokly-catalogue` or `mokly-html` from calling html5gum's tokenizer
        directly and reading ordinary unknown wrapper attributes again. That
        is the class of CLI defaults review finding 1. Severity Low, effort
        Medium. Options: A, a README rule, which nothing enforces, Small
        (estimate); B, a workspace `clippy.toml` `disallowed-methods` entry
        for the html5gum tokenizer constructors, allowed with `#[expect]` in
        the two boundary files, Medium; C, make the boundary the only
        html5gum user, with Mokly-owned token types, Large. Recommended: B.
        B is a new lint, so it needs the user.
    - User decisions 115 and 116 (2026-10-21): A now, C after the merge, in
      parallel. Decision 115 A records the current global wrapper-attribute
      filtering rule. Decision 116 A records the current `html_tokens::parse`
      consumer rule. Phase 2 of the HTML pipeline plans options C for both
      boundaries after the merge.
    - Option A of both merged in integration batch 21 as `033e5059`, from
      `rebuild/html-docs-115a-116a`. Options C are post-merge work in the
      post-merge section.
  - [x] F21: restore empty wrapper source slots during plaintext repair,
        follow HTML parser markup contexts for noscript and foreign style or title
        content, validate saved variant slot fragments, name reserved navigation
        warnings as rejections, and preserve authored page ignore wrappers for
        Rust region composition.
        Evidence: `.context/f21-item2-slot-red.log`,
        `.context/f21-item3-warning-red.log`, and
        `.context/f21-item4-sidecar-green-final.log`.
  - [x] CLI defaults hub finding 2: user decision 86 D removes the whole
        successful private publish directory, including reservation locks.
        Evidence: `.context/publish-cleanup/`.
  - [x] Resolve user item 88 (CLI defaults hub finding 6): Props fields
        reorder after the detail loads. Entry detail v2 carries the declared
        control order, but until the detail arrives the Props tab shows the
        index's alphabetical order, and then the fields jump. Severity Low,
        effort Small. Options: A, show the Props fields only after the routed
        detail arrives, with a pending state, Small; B, keep the sorted
        fallback and state it in the controls contract, Small (estimate); C,
        carry `controlOrder` in the catalogue index, which makes index v8,
        Large. Recommended: A.
    - User decision 88 (2026-10-21): A. The Props fields wait for the routed
      detail. Work: W2 on `rebuild/viewer-88a`.
  - Outside the scope: `tests/sidecar_postcss_loader_evidence.test.ts` fails on
    Node 22.14 because `node:module` has no `registerHooks`. Separate Node-floor branch.
  - Outside the scope: `tests/static_postcss_base_evidence.test.ts` reports
    `0 != 1` on Node 22.14. Separate Node-floor branch.
  - Outside the scope: `tests/serve_process.test.ts`, "the verification registry
    names Serve's group until it drains", failed with
    `Verification owner {id} has no parent`. The isolated rerun passed.
    Suspected source: concurrent process-registry cleanup. Separate branch.
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
  - [x] F12: follow-ups of F10 and F11, given by the orchestrator on
        2026-10-20, one commit each. F12 merges F10 and F11 first, because
        both wait in batch 13. Merge decisions: `.context/f12/merge-decisions.md`.
    - [x] `viewer_details.spec.ts` imports the shared Details copy, paths,
          viewports and readers, with the heading and list checks.
    - [x] `mokly-css-evidence-presentation.md` names the stage labels of each
          view state, as the viewer shows them.
    - [x] In the standalone shell, a detail of another deployment keeps the
          destination's loading stage until the full page load. The F11
          deployment case now fails if the outgoing document shows the
          unavailable stage. An embedded host behaves as before.
    - On 2026-10-21, F12 decision 6, which this record first called
      decision 1, moved to user item 89. F12 review finding 2 moved to user
      item 90. Both follow this F12 record.
    - [x] Outside the scope of F12 review 1, line 93, and review 2, line 86:
          component copy used both "variant" and "saved view". The stage
          read "No changes to this variant", and Details read "No changes
          to this saved view." Fixed on 2026-10-21 by
          `rebuild/viewer-followups-v2` (`09d38589`): every component
          sentence says "variant", the term of the variants contract, and
          the protocol, guides, design copy and tests follow.
  - [x] Resolve user item 89 (F12 decision 6): what an embedded host shows
        after another deployment. `mokly-viewer.md` says that a different
        `deploymentId` emits one `onError` and leaves the installed state in
        place, but not what the stage shows. Today the embedded host shows
        the unavailable stage with Try again, and the retry cannot succeed
        until the host replaces `index`. Severity Medium, effort Small.
        Options: A, state the current behaviour in `mokly-viewer.md` and add
        an embedded test, Small; B, keep the loading stage until the host
        replaces `index`: set `reloadsOnDeployment` on the embedded source,
        state the rule in `mokly-viewer.md`, and test it, Small; C, a
        "replaced" stage that shows the `onError` copy without Try again,
        which needs new copy, a mockup, and spec rows, Large. Recommended: B,
        because it shows no action that cannot work.
    - User decision 89 (2026-10-21): B. Work: W1 on `rebuild/viewer-89b`.
    - Done in `4980c9c4` on `rebuild/viewer-89b`: a detail of another
      deployment no longer fails the entry, so an embedded host keeps the
      loading stage until it replaces `index`. 89 B kept the loading stage by
      removing the `reloadsOnDeployment` flag, not by setting it on the
      embedded source as option B said. `mokly-viewer.md` and the shell
      delivery contract state the rule. Evidence: `.context/viewer-89b/`.
  - [x] Resolve user item 119 (viewer follow-ups round 2 follow-up): build
        each entry kind's sentences from one word.
        `packages/viewer/src/shell/entry_wording.ts` writes the sentences of
        each kind separately, so one kind used two words for one thing.
        Severity Medium, effort Medium. Code-structure findings wait for the
        user. Options: A, keep the current sentences and the new copy test,
        Small (estimate); B, derive the sentences of each kind in
        `entry_wording.ts` from one noun per kind, so that a kind cannot mix
        words, Medium. Recommended: B. The user chose B on 2026-10-21, and
        Milestone 10.7 applies it.
    - User decision 119 (2026-10-21): B, build each kind's sentences in
      `entry_wording.ts` from one noun per kind. Work: W2 on
      `rebuild/viewer-119b`, after 84 B.
  - [x] Resolve user item 90 (F12 review finding 2): a failed step detail
        still flashes the error during a deployment reload. On a use-case
        route, the use case detail starts the page load, but a 404 for a
        removed step screen marks the route failed. So the old document
        shows "This user flow could not be shown" until the page load.
        Severity Low, effort Small. Options: A, after a deployment outcome,
        clear the route's failed marks and ignore its later failures for
        every source, Small; B, do A only when the source reloads the page,
        Small; C, a separate "replaced" delivery status, Large. Recommended:
        B. Previous examples: F11 and `89f8f6cd` for a route with one detail.
    - User decision 90 (2026-10-21): C, a separate "replaced" delivery
      status. Work: W1 on `rebuild/viewer-90c`. The hub moved this work from
      W2 to W1 on 2026-10-21.
    - Done in `9ef52160` and `2a5f0768` on `rebuild/viewer-90c`: the first
      deployment change stops every detail load, and a route that still
      waits gets the replaced status. `0a420f28` on
      `rebuild/viewer-139a-140b` applies option B of finding 1 of the fresh
      review of 89 B and 90 C: the replacement also ends the live
      connection, so no index loads after it. Evidence:
      `.context/viewer-90c/` and `.context/viewer-139a-140b/`.
  - [x] Resolve user item 139 (90 C decision 1): what the replaced stage
        shows. The replaced delivery status of 90 C shows the loading stage
        in both hosts, which is the stage that 89 B gives an embedded host.
        The spec has no words for a replaced catalogue. Severity Low, effort
        Small. Options: A, keep the loading stage for the replaced status in
        both hosts, and add one sentence about it to the `preview-loading`
        design description, Small; B, show one new line in the same quiet
        stage, "Loading the new catalogue…", in both hosts, after a fifth
        design screen "Catalogue replaced", Large; C, as B with the words of
        the host message, "The catalogue changed. Loading the new
        version…", Large. Recommended: A.
    - User decision 139 (2026-10-21): A. Work: W1 on
      `rebuild/viewer-139a-140b`.
    - Done in `57c2ca36` on `rebuild/viewer-139a-140b`: the `preview-loading`
      design description and the shell design inventory say that the same
      loading stage covers a replaced catalogue. The code already showed it.
      Evidence: `.context/viewer-139a-140b/`.
  - [x] Resolve user item 140 (90 C decision 2): when a use case shows a
        step failure. A use-case route loads the use case detail and each
        step detail at once. A step failure that arrives before any detail
        shows the new deployment makes the route show the unavailable stage
        until the next detail arrives. An embedded host also gets the step's
        `onError` before the catalogue message. Severity Low, effort Small.
        Options: A, keep showing a failure as soon as it arrives, Small; B,
        show a failed route only after all its details have settled, and
        keep sending the host's failure message at once, Small; C, as B, and
        also hold the host's failure message until the route settles, Medium
        (estimate). Recommended: B.
    - User decision 140 (2026-10-21): B. Work: W1 on
      `rebuild/viewer-139a-140b`.
    - Done in `d77cb6de` on `rebuild/viewer-139a-140b`: a route fails only
      after each of its details has arrived, failed, or been replaced, and
      the embedded host still gets each failure's `onError` at once. A unit
      test, a controller test, and a browser test that answers the removed
      step first cover it. Evidence: `.context/viewer-139a-140b/`.
  - [x] F13: keep concurrent sibling cleanup from invalidating ownership scans.
        Exclude sampled orphans only when their own records have disappeared.
        Keep persistent ownership failures and resource retention.
        Evidence: `.context/f13/reproduction.md`.
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
  - [x] M8 browser review 3 finding 1, High severity, Medium effort: approve
        two hosted PR measurements with fresh and restored caches before
        Required CI. Keep four shards, the job timeout, and the 60-second test
        timeout until the user decides from measured setup, shard, and
        slow-case durations. Recommended A: measure.
    - Covered by user decision 124 (2026-10-21): A, three controlled hosted
      repeats of one commit and assignment, which the CI gates workspace
      runs. Tick this line when 124 A lands.
    - 124 A landed in integration batch 23 as `cffb0713`, from
      `rebuild/ci-timing`.
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
  - [x] F15 review, on 2026-10-20: finding 32, a Serve spec header that
        claimed a capture on every run, is fixed by option A. The full
        report is `.context/m10/f15/review_1.md`.
  - [x] F15 merge of the rebuild tip `b1f3c86f`, on 2026-10-20: the tip
        moved the branch-point section of the browser guide to
        `tests/browser/comparison/README.md`, and F9b item 7 had moved the
        edited viewer README passages to `packages/viewer/docs/`. The merge
        carries each side's edits to the passage's new place. Merge
        decisions: `.context/m10/f15/merge2-decisions.md`.
  - [x] F18 merge of the rebuild tip `780f84ad`, on 2026-10-20: the tip's
        batch 15 merge kept the F9b host specs beside the D1 specs, which
        the first F15 merge had joined under decision 10. This merge keeps
        the F15 resolution and the `compactSearch` marker. The tip's copies
        of the F9b specs equal the originals. Merge decisions:
        `.context/m10/f18/merge-decisions.md`.
  - [x] F18 review, on 2026-10-20: finding 36, a re-export of
        `branchPointPaths` in `tests/browser/branch_point_test.ts` that item
        1 left without a reader, is fixed by option A. The full report is
        `.context/m10/f18/review_1.md`.
  - Outside the F18 review scope:
    - `packages/viewer/src/shell/layout_breakpoint.ts`: its header and
      `packages/viewer/src/shell/README.md` say that every shell and viewer
      rule reads `NARROW_SHELL`, but the phone layout and the compact search
      use their own widths. Separate branch.
    - `packages/viewer/src/shell/css_previews.ts`: in the embedded viewer,
      the `24rem` width limit of the preview note follows the host page's
      root font size, but its 13px text does not. Separate branch.
  - [x] F18 re-review, on 2026-10-20: finding 37, a guide sentence that
        said specs import `branchPointPaths`, is fixed by option A. The full
        report is `.context/m10/f18/review_2.md`.
  - [x] F18 re-review finding 38, on 2026-10-21: settled by option A with
        the hub's number. The F18 review decision line is now user item 109,
        and it names F18 decision 39, the number of the F18 final report.
  - Outside the F18 re-review scope:
    - `xtask/src/check/commands.rs`: the gate runs cargo without `--locked`,
      so a stale `Cargo.lock` passes the gate and fails only the release
      build. Separate branch.
  - [x] F15 review finding 33: the delivery spec selected the reused-parent
        check by its case name. Applied A as follow-up F18 item 1, as the
        orchestrator directed on 2026-10-20. The case's delivery facts hold
        the document path, and the spec checks the index for each case that
        has one. A mutation that points the fact at a component fails both
        reused-parent tests.
  - [x] F15 review finding 34: the delivery pairs repeated the shared moves.
        Applied B as follow-up F18 item 2, as the orchestrator directed on
        2026-10-20. Each moved pair takes its base path and its moved flag
        from the case's moves, and only the case-only renames write a base
        path. A mutation of one shared move fails both moved-consumers tests.
  - Outside the F15 review scope:
    - `packages/viewer/src/viewer/styles.ts`: the `mokly-top-host` container
      query of the compact search uses `35rem`, so a host page with another
      root font size leaves the 560px compact search width that
      `docs/protocol/mokly-viewer.md` requires. Separate branch.
      - [x] Follow-up F18 item 3: the rule switches at a container width of
            560px, in pixels. `tests/browser/viewer_layout.spec.ts` sets a
            10px and a 20px root font size and expects the compact control
            at 560px and the field at 561px. Both cases failed before the
            fix.
  - [x] F15 re-review, on 2026-10-20: finding 35, a live plan line that
        cited a line of `styles.ts` that the merge shifted, is fixed by
        option B. The line names the rule now. The full report is
        `.context/m10/f15/review_2.md`.
  - Outside the F15 re-review scope:
    - `tests/browser/serve_comparison_ui.ts`: the header says that Serve
      captures each selected comparison on demand, but Serve returns a kept
      comparison when the same entry is selected again. Separate branch.
      - [x] Follow-up F18 item 4: the header says that Serve reuses the
            stored comparison for the same entry while it keeps it, and that
            a refresh captures again.
    - `plans/rust-rebuild.md`: a live line cites
      `docs/protocol/mokly-component-controls.md:69`, but the tip moved the
      local storage rule to line 64. Separate branch.
      - [x] Follow-up F18 item 4: the line cites the local storage rule, not
            a line number.
    - `plans/rust-rebuild.md`: Decision 21 still names entry detail v1, but
      the tip moved the code and `docs/protocol/mokly-shell-delivery.md` to
      v2 without an amendment note. Separate branch.
      - [x] Follow-up F18 item 4: Decision 21 names entry detail v2 and has a
            dated amendment for decision default item 23 B. The checked TODOs
            that name detail v1 stay as history.
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
    - `docs/protocol/mokly-component-controls.md`: no test checks its rule
      that temporary state never enters local storage. Separate branch.
      - [x] Follow-up F9b item 3: `serve_temporary_props_status.spec.ts`
            checks that a temporary edit leaves local storage unchanged and
            that a reload shows the saved props. A mutation that stores the
            draft fails it.
    - `packages/viewer/src/shell/README.md`: 451 lines, past the 300-line
      split rule, with no recorded exception. Separate branch.
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
  - [x] M10 D1 round 4 decision 11: item 60 C from `rebuild/ci-gates`
        raises the Node floor to 22.15.0. Both PostCSS evidence tests must
        pass on that runtime and 24.21.0. The earlier exception has ended.
  - [x] Resolve user item 70 (M10 D1 round 4 decision 13): list every old
        assertion in the sweep procedure. Reviews found sweep reasons that
        missed or misstated old checks inside helpers and host branches, and
        a title that no longer states what its port proves. Covers findings
        3 to 6 of review 1 and finding 10 of review 2. Severity Low, effort
        Small. Options: A, add a step to the gap sweep procedure: list every
        assertion of the old test, with its helpers and host branches, mark
        each one proved or not proved, and check that the port's title
        states what it proves, Small; B, keep the current rule, Small.
        Recommended: A, because it covers the whole class that the two
        reviews found.
    - User decision 70 (2026-10-21): A. Done in plan bookkeeping pass 3: step
      2 of the gap sweep procedure in `docs/protocol/rust-rebuild-procedures.md`
      lists every old assertion and protocol section, marks each one proved
      or not proved, and checks the title of each port.
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
  - [x] Milestone 13 review 1, finding 5: the user must settle the Release
        Please component for core-only commits; keep the `packages/mokly`
        layout until that decision. Native builds and paired-tag publication
        remain unchanged. Settled by user decision 20 C: the CLI is the root
        `.` component. The Milestone 13 TODO "Settle Release Please selection
        for core-only commits" records the decision.
  - Milestone 6 review 2, finding 6: settled by F8 decision 21 B. Keep all
    Used by lists unavailable after one unavailable view until the next generation.
  - M8 sidecar review D2: settled by F8 decision 12 C. The wrapper uses the
    viewer profile pre-check, and Rust rechecks every returned instance.
  - [x] Milestone 9 part 2 review 3, finding 2: settle dependency selection
        for HTML-only catalogues that import package CSS; retain working
        dependencies until the user decides.
    - Settled on 2026-10-20 by user decision 74 C on the unmerged
      `rebuild/defaults-engine-deps`, which narrows default item 27 B:
      HTML-only catalogues use the working-tree dependencies for package CSS,
      and they warn when the dependency identities that govern the used
      directories differ. Mark this line settled when that branch merges.
    - Settled on 2026-10-21 in integration batch 25: `rebuild/defaults-engine-deps`
      merged as `bb6928db`.
  - [x] M8 core review 3, finding 2, and review 6, finding 7: settled on
        2026-10-20 by item 22 A and extended A, applied by default (user rule).
        Keep complete merged bounds checks, warn on saved values outside bounds,
        and reject incompatible declared steps.
  - Milestone 9 part 1 review 1, finding 11: settled by F8 decision 10 A now,
    with pnpm and Yarn support under option B required before the first release.
  - [x] Milestone 9 part 1 review 1, finding 12: User decision 69 (2026-10-21): C.
        Apply Git checkout conversion, including network-enabled LFS smudge.
        This replaces the unbuilt offline default 11 A.
  - `crates/mokly-compare/src/projection_context.rs:24-38` builds its own
    component counterpart map next to `Lookup::counterpart`. Separate branch.
  - `crates/mokly-compare/src/review_projection.rs:73-82` attaches variants
    through the kind-less `Pairing::paths` map next to `Lookup::parent`. Separate branch.
  - Milestone 12 static review 3, finding 4: settled on 2026-10-19 by decision
    2 = A. Packed-native inspection rejects `MOKLY_TEST_` for all five targets,
    including reused archives. The module-erasure test remains.
  - [x] Milestone 12 static review 2, finding 6: settled on 2026-10-20 by
        item 30 A, applied by default (user rule). Defer forced exit during
        installation, rollback, and cleanup.
  - [x] Milestone 12 publish review 1, finding 8: settled on 2026-10-20 by
        item 8 A, applied by default (user rule). Trust Mozilla and OS roots.
  - [x] Milestone 12 publish review 1, finding 13: settled on 2026-10-20 by
        item 9 A, applied by default (user rule). Remove the successful private
        snapshot and retain failed-upload output.
  - Milestone 5 review 1, finding 5: settled by F8 decision 14 A. Keep declared
    stylesheets bundled as delivery roots and align the pages.
  - [x] Milestone 5 review 2, finding 9: settled on 2026-10-20 by item 16 B,
        applied by default (user rule). Warn on unknown ignore attributes and
        fail only in strict mode.
  - [x] Milestone 4 unsafe prop integers: settled on 2026-10-20 by item 6 C,
        applied by default (user rule). Round to binary64 with a warning.
        Schema keyword precision remains open as N1.
  - [x] N1 schema keyword precision: closed on 2026-10-20 by the user's
        clarification that decision 6 C includes every authored number.
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
       comparison in the shell. Severity Medium, effort Medium. Settled on
       2026-10-20 by user decision 82 B, which Milestones 10.3 and 10.4
       apply: the shell offers the comparison for such an entry, opens it
       from Affected screens, and the design depicts its pane heading.
    2. Moved to user item 83 on 2026-10-21.
  - [x] Resolve user item 83 (viewer defaults decision 2, the second
        decision log item 32 follow-up): variant pages miss the shared
        change. The affected records name the parent as the consumer for
        every view of a component, so `projection_affected.rs` gives
        `relatedComponents` to the parent's detail only. A variant page
        without a loaded review then reads "No changes to this variant."
        while its preview changed. A parent page whose variant alone uses
        the changed component claims a shared change in its own preview (hub
        review finding 1, merged here by the orchestrator on 2026-10-20).
        Severity Medium, effort Small. Options: A, document that only the
        parent page explains the shared change, Small (estimate); B, key
        `relatedComponents` by the entry whose views each evidence item
        names, in place of the parent, and update the Status Lines rule,
        Small. Recommended: B. User item 103 option C includes B. Settled on
        2026-10-21 by user decision 103 C, which includes item 83 B:
        `rebuild/viewer-103c` keys `relatedComponents` and detail
        eligibility by the entry whose views each evidence item names
        (`3a30e389`).
  - [x] Resolve user item 84 (review finding 6): the shared-component
        sentence calls a screen "this page". "Shared component changes
        affect this preview. This page has no independent entry in
        Changes." now shows on live screens and saved views, but "page"
        means a whole-document page. The sentence is in
        `packages/viewer/src/shell/workspace_evidence.tsx`, the design copy,
        and `mokly-css-evidence-presentation.md`. Severity Low, effort Large
        for B. Options: A, keep the sentence, Small (estimate); B, word it
        for each entry kind through `entry_wording.ts`, for example "Changed
        components that this screen uses affect its preview.", with the
        design copy, the contract, the Details guide, and the tests, Large.
        Recommended: B. The user chose B on 2026-10-21, and Milestones 10.5
        and 10.6 apply it.
    - User decision 84 (2026-10-21): B. Work: `rebuild/viewer-84b`, in the W2
      workspace.
  - [x] Hub review of `rebuild/defaults-viewer`, finding 5, raised on
        2026-10-20: no artboard shows the pane heading “Components this
        screen uses changed”. Severity Low. Milestone 10.3 closes it: the
        `design/components/states/shared-impact/affected-screen` artboard
        depicts that heading in its loaded comparison.
  - [x] Hub review of `rebuild/defaults-viewer`, fixed on 2026-10-20 in
        `rebuild/defaults-viewer-fix1`: finding 2, an expanded step frame
        left a page scrim (`1ea520af`, B); finding 3, unused lookup
        operations (`fe3624df`, B, except `HistoricalManifest`); and
        finding 4, the non-goal exception (`e98815dc`, A). The orchestrator
        also assigned three problems outside its scope: the design's changed
        component line now follows the Status Lines rule (`69ffa907`), the
        catalogue column stays at 900px (`eeaea061`), and the dead workspace
        path for a catalogue without published records is gone (`37e596df`).
  - User decision 82 follow-ups for the user, raised on 2026-10-20:
    1. A moved consumer of a changed component offers no comparison.
       Severity Low, effort Small. Its Affected screens link asks for the
       comparison, but Changes lists it as a pure move with unchanged views,
       so it opens Current, and its Details end with "No changes to this
       screen." Recommended: B, apply the affected rule to every entry whose
       own views are all unchanged and whose detail names changed components,
       with the shared-component sentence. Option A keeps the rule to entries
       that Changes does not list. User item 103 covers this case. Settled on
       2026-10-21 by user decision 103 C, which applies this item's option C:
       each Unmodified view whose usage holds a changed component that the
       detail names offers the band, in or out of Changes (`80f48c61`). Its
       Details ending stays open below.
    2. Moved to user item 104 on 2026-10-21.
  - Outside the scope of user decision 82:
    `examples/basic/specs/design/components/parts/component_usage.tsx` lists
    only screens under "Affected screens", while the viewer lists screens and
    components under "Affected screens and components". Separate branch.
    User item 104 covers it.
  - [x] Hub review of `rebuild/defaults-viewer-82b`, fixed on 2026-10-21 in
        `rebuild/defaults-viewer-82b-fix1`: finding 2, a Serve update
        reopened Side by side (`5c761b5d`, B); finding 3, the affected
        artboard kept highlighting on in Side by side (`1a5ac4df`, B);
        finding 4, React hosts open Affected links in Current (`62136520`,
        A); finding 5, a check that the band is absent could pass before the
        routed detail arrived (`4670bced`, B); and finding 6, the shell
        README cited a plan decision (`295b6253`, A). The orchestrator also
        assigned two problems outside its scope: the design and the viewer
        now say that a comparison is selected when highlighting is off, and
        the shell README no longer cites "implemented in M31" (`8bf3cc4c`).
  - [x] Resolve user item 103 (hub review of `rebuild/defaults-viewer-82b`,
        finding 1): Affected links ask for comparisons that the destination
        refuses. A consumer that Changes lists as a pure move, a component
        variant consumer, and a consumer in Changes whose linked view is
        Unmodified each open Current with no band, against the intent rule of
        `docs/protocol/mokly-changes-controls.md`. Severity Medium, effort
        Large for C. Options: A, add the intent only when the destination
        will show the band, Medium (estimate); B, the Rust projection marks
        each link with the real eligibility of its destination, Large
        (estimate); C, every unchanged view that uses a changed component
        offers the band, in or out of Changes, variants included, with
        `relatedComponents` and detail eligibility keyed by the entry that
        each evidence item names, Large. C includes user item 83 B.
        Recommended: C. If the user declines C, apply A. User decision 103
        (2026-10-21): C, which includes item 83 B. Done in
        `rebuild/viewer-103c`: the projection keys (`3a30e389`), the
        per-view band rule (`80f48c61`), and the `affected-destinations` case
        of the shared branch-point set, whose journeys run in Serve, the
        static build, and a React host (`6dbdb181`).
  - [x] Resolve user item 137 (viewer-103c decision 2): links to added
        consumers ask for a comparison. `projection_affected.rs:105` sets
        `comparisonEligible` from the entry kind only, so an Affected link to
        an Added view asks for a comparison that the view cannot have.
        Severity Low, effort Small. Options: A, keep the flag and add a rule
        that a link to an Added view opens Current, Small (estimate); B, set
        the flag to false when the linked view is Added, and document it,
        Small; C, leave added consumers out of the Affected list, Small
        (estimate). Recommended: B.
    - User decision 137 (2026-10-21): B. Work: another workspace, on
      `rebuild/viewer-137b`.
    - Ticked on 2026-10-21 in integration batch 25: integration batch 24
      merged `rebuild/viewer-137b` as `3e33bcb0`.
  - [x] Hub review of `rebuild/defaults-viewer`, finding 3 remainder:
        `HistoricalManifest` had no user and no published export since
        `05923728`, but line 12 of `docs/protocol/npm-release-notes.md`
        still named it as a released type. User decision 91 (2026-10-20): B,
        delete the alias and list `Manifest`, `ManifestV10`, and
        `HistoricalManifest` with the names that `@mokly/viewer/data` stops
        exporting. Done in F20 item 3, which also deletes the unused aliases
        `HistoricalManifestPage` and `HistoricalManifestUseCase` and the
        release note's advice to replace the removed manifest and review
        types.
  - [x] Outside the scope of the hub review of `rebuild/defaults-viewer`,
        found by its fix round: eleven shell and viewer modules, such as
        `packages/viewer/src/shell/stages.tsx:81`, keep fallbacks for a
        catalogue without published records, which no delivery builds. Making
        `publicModel` required in the shell catalogue type would show which
        are dead. Separate branch. Done on 2026-10-21:
        `rebuild/viewer-followups-v1` deleted the fallbacks (`3525d264`), and
        `rebuild/viewer-followups-v2` made `publicModel` required
        (`8f3db91b`).
  - [x] Milestone 3 Phase A review 1, finding 16: settled on 2026-10-20 by
        item 4 A, applied by default (user rule). Publish build warnings are
        fatal only with `--strict`.
  - Open from the M14 gap sweep close-out review, report under
    `.context/m14-gap-sweep/review.md`:
  - 34: settled on 2026-10-21 with option A, as the orchestrator asked: a
    new open Milestone 14 line names audit finding 7 and the branches that
    it waits for.
  - [x] `docs/protocol/mokly-timings.md:137`: the scale fixture paragraph says
        that setup always adds the unrelated rule to the first shared
        stylesheet, but `--stylesheets 0` adds none. Found by the gap sweep
        close-out review. Separate branch. Fixed by `661a9fe7` on
        `rebuild/plan-bookkeeping-3`, which integration batch 21 merged
        (`d650b856`): the paragraph now says that `--stylesheets 0` adds no rule.
  - `plans/rust-rebuild.md`, the open Milestone 14 TODO "Report exact
    consumed-byte digests for the PostCSS module graph": it still names
    "supply immutable generation inputs" as a design path, but decision 56 A
    and the PostCSS page reject enforced immutable inputs. Found by the gap
    sweep close-out review. Separate branch.
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
  - [x] Follow-up: classify CSS statements without a block once in the
        section reader, for the module check, the renamer, and the token
        check. Effort Medium. Covers M14 nesting report finding 22: a wrapper
        left open at the end of input in a declaration block got the generic
        syntax message. Previous examples: `.c{}.y`, where the token check
        fired instead of the syntax check. Done on 2026-10-20 in nesting
        round 7, as the orchestrator asked: in a style rule's block, those
        cases now get the catalogued empty-wrapper message, which the wrapper
        table test pins. In a block where lightningcss reads no rules, such a
        statement stays as authored.
  - [x] `crates/mokly-css/src/module_integrity.rs:20`: the CSS Modules token
        check always reports line 1, column 1, though its catalogue row
        shows `{line}:{column}`. Found by the M14 nesting round 6 review.
        Separate branch. Done on 2026-10-20 in nesting round 7, as the
        orchestrator asked: the failure points at the first authored token
        that scoping would change, or at the end of the stylesheet when
        scoping only adds tokens there.
  - [x] Resolve user item 111 (M14 nesting report item 24, round 7 review
        finding 1): cssparser skips an HTML comment token (`<!--` or `-->`)
        before a stylesheet statement, but the section reader keeps it. So
        the scanners read `<!-- @value x: 1;` and `-->@keyframes k{…}` as
        style rules, while lightningcss reads them as at-rules. The `@value`
        ships, and the keyframes keep `k` while its references are renamed.
        Severity Low. Options: A, record the gap and narrow the README parity
        claim, Small; B, skip those tokens before a stylesheet statement
        through a root grammar, Medium; C, read each statement's start and
        kind from cssparser's own parsers, Large and blocked. Recommended: B,
        because it aligns the scanners with lightningcss and with the
        `@value` rule. B makes such a stylesheet fail, and it builds today,
        so keep the behaviour until the user decides.
    - User decision 111 (2026-10-21): A now, C after the merge, in parallel.
      Option A records the gap in the CSS Modules README and protocol page
      and narrows the README parity claim. Option C remains a non-blocking
      post-merge follow-up.
  - Open from the M14 nesting round 7 review, report under
    `.context/m14-nesting/r7/review-r7.md`:
  - 24: moved to user item 111 on 2026-10-21.
  - 26: settled on 2026-10-21 with option B, the wider fix, as the
    orchestrator asked: the token check compares the optional fingerprint
    entries up to the longer length, so one rule covers changed, added, and
    dropped tokens, and the case `a{}b` scoped to `a{}` points at 1:4.
  - Open from the M14 nesting round 7 re-review, report under
    `.context/m14-nesting/r7/review-r7b.md`:
  - `crates/mokly-css/src/_tests_/token_sections_tests.rs:26`: settled on
    2026-10-21 in nesting round 8, as the orchestrator asked: the
    classification test doc now names the text case in a style block, an
    at-rule without a block under an unknown keyframes name.
  - `crates/mokly-css/src/_tests_/wrapper_table_tests.rs:61`: settled on
    2026-10-21 in nesting round 8, as the orchestrator asked: the
    `STYLE_RULE` doc now names an at-rule without a block under an unknown
    keyframes name as text.

## Post-merge follow-up (non-blocking)

- [ ] Resolve user item 111 with option C: take each statement's start and
      kind from cssparser's parsers so the CSS Modules scanners align with
      `lightningcss`. Keep the iterative, heap-only depth guarantee and add
      differential coverage for repository stylesheets and a generated corpus.

- [ ] Add a byte-bounded cache of unused compiled recipes, revalidated before
      reuse, under F8 decision 59 option C. Revalidate compiler and resolution
      inputs, and agree the byte budget before implementation. The current
      recipe lifetime stays in force under option A until this work lands.

- [ ] Run the bookfolio catalogue through build, serve, Changes, and watch
      after the user supplies access. The user took it out of the rebuild
      scope on 2026-10-20.

- [ ] Share one verified opaque-asset spool for each Serve generation and
      route, released with its generation, under the M14 Serve budgets (M14
      review 6, finding 5, option B; user decision 61, 2026-10-20).

- [ ] Bring large React usable startup under 5,000 ms
      (compilation cache redesign, decision 57 option A); measured 10.5 s
      on the release build on 2026-10-19.

- [ ] Replace the Intel macOS release runner before GitHub retires its Intel
      images, preserving native build and execution coverage.

- [ ] Design confined inputs for the PostCSS reads that observation leaves
      opaque: native addons, helper processes, workers, metadata reads,
      `fs.openAsBlob`, and WASI. Cover native, helper, and worker reads,
      private resolution metadata, unknown descriptor positions, opaque
      providers and options, and unavailable native identity. User decision
      114 A (2026-10-21) moved this work after the merge. Design:
      `.context/rust-rebuild/delegation/m9-compare/design-postcss-digests.md`.

- [ ] Redo the in-range dependency updates and the Rust 1.99.0 move of the
      closed #197 after the rebuild merges. User decision 65 A, 2026-10-21.

- [ ] Port the wider clock lint of the closed #174: the timing guard for
      `packages/viewer/tests` and three more clock forms. User decision 66 A,
      2026-10-21.

- [ ] Port the empty-test assertion guard of the closed #153, which fails
      a unit test that makes no assertion. User decision 66 A, 2026-10-21.

- [ ] Resolve user item 98 (engine review 2 finding 2, option C, a class
      decision): let the parser choose the plaintext point. Four cases of
      serializer-versus-parser divergence so far: hub review 1 finding 2,
      `b0842cad`, and review 2 findings 2 and 4. Severity Low, effort Large
      for B. Options: A, keep the fail-safe check that retries with all text
      escaped when the parser disagrees, which engine fix round 3 applied on
      `rebuild/defaults-engine` as its option B, Small (estimate); B,
      serialize first with all text escaped, find the first HTML `plaintext`
      element by its repair id, and write raw text only after it, Large.
      Recommended: A now, and B as a post-merge follow-up.
  - User decision 98 (2026-10-21): B, in parallel and non-blocking. Item 98
    now also covers the source-identity redesign: the M15 follow-up "carry
    source identities through HTML5 token processing for all elements", F19
    review finding 2 B, and F21 review finding 5. B builds one HTML pipeline
    in which html5ever's tree builder reads the tokens of the token pass,
    chooses every text mode, and gives each element its source position.
    Work: W6 on `rebuild/html-pipeline`. It must not delay the final pull
    request.
  - Moved here from Milestone 14 on 2026-10-22. User decision 147 B keeps
    98 B post-merge.

- [ ] Split the public HTML parser into an authored parse and a
      delivered-document parse that every caller chooses, in phase 2 of the
      HTML pipeline. User decision 115 C, after option A merged as `033e5059`.

- [ ] Make the HTML token boundary the only html5gum user, with Mokly-owned
      token types, in phase 2 of the HTML pipeline. User decision 116 C, after
      option A merged as `033e5059`.

- [x] Record PostCSS module paths through an asynchronous resolve hook and a
      message port, so that loader-supplied modules get a witness and a late
      baseline. User decision 117 C, after option A merged as `951c666e`.
  - User decision 117 (2026-10-21): C, ported in `c4c736f2` from
    `rebuild/postcss-loader-paths` at `9739ebaa`. A file module that a
    consumer module hook supplies keeps its resolved path, so it gets a
    late baseline. Its transformed source gets no raw witness. Evidence:
    `.context/port-117c/`.

- [x] Resolve PostCSS loader-path review finding 2 (performance): each
      repeated asynchronous registration keeps the earlier observer hooks,
      and each message port stays open until its peer closes. Severity Low,
      performance, effort Large for B. Options: A, close the superseded
      ports after they drain, while the duplicate hook work stays, Medium;
      B, use one registration broker and one observer channel, and keep the
      consumer hook order and output, Large. Recommended: B. No option is
      applied.
  - User decision (2026-10-26): closed with no work by B of the 117 C port
    finding. Mokly registers no asynchronous hook since `07893644`.

- [x] Resolve the 117 C port finding (code structure): the asynchronous
      observer of 117 C adds hook work but no tested path. Synchronous
      module hooks wrap the asynchronous loader chain, so the path-only
      synchronous hook already reports each loader-supplied module. With
      the asynchronous observer off, the 12 loader-path tests and the `tsx`
      smoke builds still pass on Node 22.15.0 and 24.21.0. It adds only the
      path of a hook module that a later `module.register` call loads.
      Severity Low, code structure, effort Medium for B. Options: A, keep
      both observers and state in the code why the asynchronous observer
      stays, Small; B, remove the asynchronous resolve hook, its message
      port and drain, and its build entry, which also closes loader-path
      review finding 2, Medium. Recommended: B. No option is applied.
      Evidence: `.context/port-117c/`.
  - Port review finding 1 found one more cost of the asynchronous observer.
    Its registration in the preload under a loader flag started the loader
    thread before consumer preloads and hid their descriptor ranges. The
    worker now registers it after consumer preloads. Option B also removes
    this class.
  - User decision (2026-10-26): B, applied in `07893644`. The first answers,
    1 B, 2 A, 3 B, and 4 B for the four 117 C port items, conflicted,
    because 4 B removes the observer that the others change. The user then
    chose to apply 4 B, to close items 2 and 3 with no work, and to state
    for item 1 that hook modules keep no path.

- [x] Resolve 117 C port review 2 finding 1 (docs or spec): the loader-flag
      fix in `6ce66aec` drops one hook module path. Under a loader flag, the
      worker now registers the asynchronous observer after consumer
      preloads. So a hook module that a preload registers and that the
      loader hooks supply gets no path, although the protocol says that
      such modules keep their paths. Main never records hook module paths.
      Severity Low, docs or spec, effort Small for B. Options: A, state the
      gap in the protocol and the README, Small; B, under a loader flag,
      also register the observer just before the first consumer
      `module.register` call, and add a hook-path case, Small; C, decide it
      with the 117 C port finding, whose option B removes the asynchronous
      observer and needs A in a wider form, Medium. Recommended: B. No
      option is applied.
  - User decision (2026-10-26): C, with B of the 117 C port finding. The
    protocol and the README state in `07893644` that modules of Node's
    asynchronous loader thread, such as hook modules, have no path.

- [x] Resolve 117 C port review 2 finding 2 (test): the release inventory
      check does not require `dist/sidecar/postcss-async-loader.mjs`, which
      the preload loads by path through `module.register`. A build that
      drops it still passes the release check, and PostCSS then fails for
      consumers with module hooks or a loader flag. Severity Low, test,
      effort Small for A. Options: A, require the bundle in
      `scripts/release/package_reports.mjs` and add it to the missing-file
      cases of `tests/release_native.test.ts`, Small; B, one shared list of
      the separate sidecar bundles for the build and the release check,
      Large. Both options add a release rejection. Recommended: A. No
      option is applied.
  - User decision (2026-10-26): closed with no work by B of the 117 C port
    finding. The package has no such bundle since `07893644`.

- [x] Resolve 117 C port review 3 finding 2 (test): an assertion in
      `tests/sidecar_postcss_async_loader.test.ts` says that asynchronous
      loaders keep supplied module paths. It passes without the path
      observer, because Mokly resolves each configured plugin itself.
      Severity Low, test, effort Small for A. Options: A, assert the path of
      a helper module that Mokly does not resolve and that the loader
      changes, Small; B, change only the assertion message, Small.
      Recommended: A. No option is applied.
  - User decision (2026-10-26): A, applied in `3b5f58b9`. The plugin imports
    a helper that only Node resolves, and the test asserts the helper's
    path. The loader-flag cases fail with the path observer turned off.

- [x] Resolve the shared-ledger follow-up (code structure), the wider fix of
      117 C port review 3 finding 1: the preload and the worker share each
      evidence function through its own global symbol key. A key that loses
      its caller stays behind, as the module path key did after `07893644`.
      Severity Low, code structure, effort Medium for B. Options: A, keep
      one key for each shared function, Small; B, share one ledger object
      under one global key, Medium. Previous examples: `flushKey` and
      `loaderFlagKey`, removed in `07893644`. Recommended: B. No option is
      applied.
  - User decision (2026-10-26): B, applied in `bb95b90b`. The preload shares
    one frozen ledger object under the key `mokly.postcss.ledger`.

- [x] Resolve 117 C port review 5 finding 1 (test): no test fails when the
      worker's shared generation reset breaks. The host keys each worker by
      context, so the reset never changes the generation in the product.
      Severity Low, test, effort Small for B. Options: A, a test in which a
      child loads the built preload and the evidence module and starts a
      second generation, Small; B, A as a table over every ledger member
      that fails when a member has no case, Small; C, a comment that the
      call guards a context change that the host does not make, Small.
      Removing the reset deletes functionality on main, and mutation tests
      in the gate add a gate, so both are blocked. Recommended: B. No option
      is applied.
  - User decision (2026-10-28): B, with the coordinator reviewer's
    correction, applied in `3f40207a`. The ledger-level reset test already
    existed, so the new test installs a fake shared ledger and checks that
    each ledger function reaches it. A table holds one case per function,
    and the test fails when a function has no case.

- [ ] Resolve user item 136 (viewer-103c decision 1): a pure move's Details
      deny its comparison. For an entry that Changes lists only as a move,
      the Details end with the terminal line "No changes to this screen.",
      while its band offers the comparison of the changed components that
      its views use. Severity Low, effort Large. Options: A, keep the terminal
      line, Small (estimate); B, for an entry that Changes lists only as a
      move, show the shared-component sentence in a wording without "no
      independent entry in Changes", which the 84 B rewording can supply,
      and draw the design first, Large; C, leave out the terminal line when
      a shown view uses a changed component, design first, Large
      (estimate). Recommended: B.
  - User decision 136 (2026-10-21): B, as work after the merge. The rebuild
    branch records this item as the line "User decision 103 follow-up for
    the user" under item 104. Keep one line when both reach the plan.

- [ ] Resolve user item 138 (F22 decision): JavaScript page wrappers get no
      attribute warning. Unknown attributes on ignore wrappers that a
      `renderPage` callback returns are removed without the
      `html-ignore-attribute` warning, because the sidecar contract has no
      warning transport for callback HTML. Severity Medium, effort Large.
      Options: A, add warning transport to the sidecar render record and one
      `html-ignore-attribute` warning per page callback body and attribute,
      Large; B, keep callback HTML warning-free and limit the warning to
      authored bodies, Small (estimate). Recommended: A. The F22 branch
      records this item as "Item 131", and integration batch 20 renumbers
      that line to 138. Keep one line when both reach the plan.
  - User decision 138 (2026-10-21): A, as work after the merge.

- Publish the first 0.x release of the new core: platform packages, viewer,
  then CLI; verify each registry package.
- Reset Mokly Cloud and republish its catalogue with the released CLI.
- Decide on a WebAssembly fallback for platforms without a native package.
- Optional hardening of base installs, which the user may choose later: 122 C,
  a Yarn 4.14 floor; 141 C, no unscoped Yarn credentials, and a fallback when
  a base `.yarnrc.yml` sets `npmScopes`; and 142 B, an absolute Git program
  and no Git transport for npm base installs.

### Open user items, deferred by the user on 2026-10-21

The user decided on 2026-10-21, at about 19:10Z, that the open review items
and decisions do not block the merge into `main`. They become post-merge
follow-ups, and the user decides each solution later. Only the merge set of
Milestone 15 waits before the merge.

User decision 146 (2026-10-21): C. From now on, a new review finding or
decision goes to this post-merge section, unless it is a High security
issue, a data-loss risk, or a failing check. The hub records it here and
does not ask the user before the merge.

- [ ] Resolve user item 64 (engine R20-1, from M14 review 6 finding 8):
      decide on streamed Git blob copies and batched digests. Each opaque
      asset digest starts its own Git process, and delivery buffers a
      copy. 64 assets cause 128 opaque Git commands, and a 16.78 MB file
      needs two payload copies during delivery. Every bound holds.
      Severity Low, effort Large. Options: A, remove per-asset process
      startup and the extra full-blob buffer, and preserve all existing
      bounds, Large; B, retain the measured adapter, Small (estimate).
      Recommended: A. No option is applied.

- [ ] Measure Git opaque-asset digest commands and buffered delivery under
      the M14 comparison workloads. Use the cost to decide on streamed blob
      copies and batched digests; keep the 64 MiB Git bound (review 6, finding 8B).
      Evidence: `.context/rust-rebuild/m9-lookup-and-matching/git-assets.md`.
  - Moved here from Milestone 14 on 2026-10-22, under user decision 147 B.
    The measurement informs user item 64 above.

- [ ] Resolve user item 87 (CLI defaults hub finding 5): define the new
      warning messages. `html-ignore-attribute`, `props-control-bounds`,
      and `props-unsafe-integer` have no defined message. Invocation
      warnings name the rendered entry and only the prop path, for example
      entry "home": prop "/count" when `home` has no `count` prop, and they
      merge with the entry's own warning. Prop names appear as "/count" and
      as "count". Severity Low, effort Medium for B. Options: A, define the
      current messages in the three contracts and add the code to the HTML
      Diagnostics table, Small (estimate); B, also make invocation warnings
      name the component path and the instance id and use one prop-name
      form, then define the messages, Medium. Recommended: B.

- [ ] Resolve user item 95 (F9b item 7, decision 23): the shell README
      stays past 300 lines. It had 494 lines under one heading on
      2026-10-21, for 193 flat files, and the link check reads only
      `README.md` files, `docs/`, `plans/`, and `AGENTS.md`. Severity
      Low, effort Small. Options: A, keep one page, add a heading per
      subject, and record the exception, as decision 2 A did for the
      browser test guide, Small; B, move the standalone paragraphs into
      `src/standalone/README.md` and record the exception for the
      rest, Small (estimate); C, split it into
      `src/shell/docs/{subject}/README.md` pages, Small (estimate); D,
      move the mechanics into module doc comments and keep an index,
      Large. Recommended: A, because a split by subject needs doc-only
      folders in the source tree, and module mechanics belong in code
      comments.

- [ ] Resolve user item 97 (review 2 finding 3): owned proof state waits
      for the whole catalogue. Decision 73 C made owned instance proof wait
      for catalogue-wide own-page proof. So every view keeps two
      whole-document instance indexes and candidate proofs until all views
      are collected, an estimated 190 MB across 5,850 views at 1,000
      elements per side, not measured. Severity Medium, effort Medium.
      Options: A, pass the state by value only, which engine fix round 3
      applied on `rebuild/defaults-engine`; B, keep compact candidates:
      deduplicated instance chains per owner and rule identity, candidates
      only for owners with changed rules, and one address pair per view,
      Medium; C, a counted test at two catalogue sizes, Medium (estimate).
      Recommended: B, because it removes a memory regression that
      `rebuild/defaults-engine` adds.

- [ ] Resolve user item 99 (collector review finding 2): partial capture can
      drop an earlier view. The growing summary charge means that a later
      view can stay while an earlier view that fits falls back to its
      source. Output bytes do not change. Only the number of views that
      render again when memory is tight changes. The docs do not define
      which views a partial capture keeps. Severity Low, effort Small.
      Options: A, record the rule and the default, which the collector
      decision under the large fixture TODO now does, Small; B, make route
      order strict, so that no later view stays after the first skip or
      trim, which is simple to state and test but can keep fewer views,
      Small (estimate); C, restore the old rule: apply it again when the
      final capacity is known and render each dropped view that now fits,
      Medium. Recommended: A.

- [ ] Resolve user item 102 (82 B delegate decision 4): the Serve heading
      of an affected-only entry comes from view usage. Severity Low.
      Option B is applied by default (user rule): see the record "Serve
      pane heading, requirement applied by default" of 2026-10-20 above
      the milestones. The reviewer agrees. Options: A, head a view from
      its records and `affected` evidence only; B, also head a view whose
      usage holds an instance of a changed component that the entry
      detail's `relatedComponents` names. Recommended: B. Close the item as
      B unless the user objects.
  - Option B is in the code on the rebuild branch from an earlier default,
    and it stays until the user decides.

- [ ] Resolve user item 104 (82 B delegate decision 6, with the second
      user decision 82 follow-up and 103 C review finding 1): the
      component artboard shows only screens in Affected, and no artboard
      depicts an affected-only component's comparison, which reads
      "Components this variant uses changed". Severity Low, effort Large
      for B, because B is a new artboard. Options: A, keep the component
      case in the design copy only, Small (estimate); B, draw three states
      in the separate branch that fixes the design's Affected list: the
      affected component variant, an Unmodified view that stays in Changes
      and shows the band, and the component's Affected list, which shows
      components too, Large. Recommended: B. With either option, correct
      the sentence of `mokly-component-design.md` that gives known
      unchanged shown views no comparison row.
  - 103 C review finding 1 widened option B on 2026-10-21. The
    affected-screen artboard, `affectedScreenScreen` in
    `examples/basic/specs/design/components/states/shared-impact/screens.tsx`,
    already covers the screen state. The Moved artboard,
    `review/outcomes/moved.tsx`, shows changed content, so it does not
    cover an Unmodified affected view.

- [ ] Resolve user item 108 (engine round 4 own review finding 3): nested
      matches changed own previews. After decision 96 C, a component can
      hold a record for a match inside a nested copy of itself: X renders
      Y, and Y renders another X. That record made the component's own
      previews show Changed and added dependency reasons on its consumers.
      Severity High, effort Large. Options: A, one page-level flag for
      nested-only matches, but a page that mixes nested and own sources
      keeps the wrong result, Medium (estimate); B, carry the stylesheet
      paths of the kept own-page matches through reduction and
      classification, while Details keep the nested record, Large because
      it changes two crates. Recommended: B. Hub review 3 found B correct.
  - Option B is in the code on the unmerged `rebuild/defaults-engine`, in
    `e6b2b99c`, from an earlier default, and it stays until the user
    decides.

- [ ] Resolve user item 109 (F18 decision 39): extend the unused internal
      export check to the test helper trees. It is a stricter check, so it
      needs the user. Covers finding 36. Previous examples: `ec52f856` and
      `fe3624df`. Severity Low, effort Medium. Options: A, keep the current
      scope, Small (estimate); B, check `tests/browser`, `tests/helpers`,
      and `packages/viewer/tests`, and leave the catalogue fixtures out,
      Medium. F20 removed all 47 unused exports, so B starts with no
      baseline entries. Recommended: B.

- [ ] Resolve user item 112 (M14 nesting report item 27, round 7
      differential): removing a bare `:global` or `:local` at
      `crates/mokly-css/src/rename_selectors.rs:99` can change a statement.
      Before an at-keyword, it turns a rule into an at-rule, for example
      `:global@media all{}` into `@media all{}`. Alone in a statement
      without a block, it empties the statement, so `.p{:local}` builds as
      `.p{}`. The token check misses both where its two readings agree.
      Severity Low. Options: A, keep the behaviour, Small; B, add the kind
      of each statement to the token check's fingerprint, so that any edit
      that changes a statement fails with the catalogued message, Small;
      C, keep a bare wrapper that no selector follows, so that lightningcss
      reports the syntax error, Small, but not for the `:global()` form.
      Recommended: B, because one guard catches every edit that changes a
      statement. B and C reject stylesheets that build today, so keep the
      behaviour until the user decides.
  - `crates/mokly-css/src/rename_selectors.rs:181`: removing a `:global()`
    wrapper before an at-keyword, as in `:global(@media all){.a{}}`, also
    turns a rule into an at-rule. Found by the M14 nesting round 7 review.
    User item 112 covers it.

- [ ] Resolve user item 113 (M14 nesting report item 28, round 7
      differential): in a rule list, the module check at
      `crates/mokly-css/src/module_checks.rs:30` skips the block of a
      statement that starts like a custom property, such as `--x:{…}`. The
      renamer and the token check read the same statement as a rule with a
      block, so an `@value` in that block passes the module check. In
      keyframes and `@document` blocks, such a stylesheet builds today.
      Severity Low. Options: A, keep the skip, Small; B, delete it, so that
      an `@value` there fails with its catalogued message, Small.
      Recommended: B, because it removes the last statement that one
      scanner reads on its own, and `@value` fails at every rule level. B
      rejects stylesheets that build today, so keep the skip until the
      user decides.

- [ ] Resolve user item 121 (pnpm and Yarn review finding 7): marker
      fixtures for every script and hook guard. No test asserts
      `--ignore-pnpmfile`, `YARN_IGNORE_PATH=1`, `--no-default-rc`, or the
      `YARN_PLUGINS` removal. Severity Medium, effort Medium. Missing tests
      wait for the user. Options: A, assert each flag in
      `manager_command_tests`, Small (estimate); B, A and also cold-build
      fixtures, `.pnpmfile.cjs` and `.mjs`, a Berry `yarnPath` script, and
      an ancestor Classic `yarn-path`, that write a marker file that the
      test requires to be absent, Medium. Recommended: B.
  - Fix round 2 finding 5 joins it: the marker fixtures in
    `tests/static_base_managers.test.ts` and
    `tests/helpers/base_manager_fixture.ts` look in the wrong place.

- [ ] Resolve user item 123 (wider fix of pnpm and Yarn review findings 3
      and 4): one typed lockfile model. Parse pnpm and Yarn lockfiles into
      a typed model with importer and locator context, check only path
      fields, and test it with a differential corpus against Yarn's parser.
      Effort Large. It is a wider fix, so the hub grades no severity. The
      follow-up line on `rebuild/base-pnpm-yarn-fix1` names the same wider
      fix. Options: A, keep the scalar scans with the targeted fixes, Small
      (estimate); B, the typed model, Large. Recommended: B.

- [ ] Resolve user item 128 (F21 decision): saved variant slot element
      checks. The F21 record gives no severity or effort. Options: A, keep
      the checks and state the rule in `mokly-html-components.md`; B, keep
      only the required `html-ignore-attribute` and `html-foster-parented`
      warnings. Recommended: A. The rebuild branch records this item as the
      line "Item 128" after the F21 record. Keep one line when both reach
      the plan.
  - Saved slots skip the forbidden and unknown element checks, because a
    new build error needs the user's yes (item 128 is open).

- [ ] Resolve user item 129 (F21 review finding 5): the empty-slot
      regression test no longer tests its fix. After `22657ea0`, both
      wrappers in the plaintext-repair test have positions, so the test
      passes with the old code. Severity Low, test, effort Small. Options:
      A, call `parse::located` directly with a trailing plaintext and one
      positioned wrapper, and assert that the other has no position, Small;
      B, the source-identity redesign of the HTML pipeline, user decision
      98 B, Large. Recommended: A until phase 2 of 98 B lands.

- [ ] Resolve user item 130 (F21 review finding 7): intermediate delegate
      commits that do not build. `mokly-catalogue` does not compile from
      `06742270` to `c7260846` on `rebuild/followups-f21`. One test expects
      the wrong position until `b1cc2dd6`, and two commit messages
      misdescribe their change. Severity Low, process, effort Small.
      Options: A, keep the history and record the range in the plan,
      Small; B, rewrite the branch so that every commit builds, effort not
      recorded; C, add a per-commit build step to delegate briefs, effort
      not recorded. Recommended: A. C best protects later branches.

- [ ] Resolve user item 132 (actionlint review finding): the label
      coverage test misses workflow labels. `tests/actionlint_config.test.ts`
      scans only `.yml` workflows. It also ignores a job's own `runs-on`
      label when the job also has a matrix, as three `ci.yml` jobs do.
      Severity Low, effort Small. Options: A, include `.yaml` workflows and
      each such job's own `runs-on` label in the label coverage test,
      Small. Recommended: A. Missing tests need the user. The rebuild
      branch records the first part as a "Finding" line here. Keep one
      line when both reach the plan.

- [ ] Resolve user item 133 (integration batch 19 decision 1, widened by
      batch 21): JavaScript document keys depend on the checkout folder and
      the root manifest. `packages/mokly/src/sidecar/bundle.ts` hashes the
      absolute source, dependency, and repository roots, and every parent
      `package.json` of each bundled module, into the bundle identity, which
      feeds every JavaScript document key. Builds of one commit from two
      folders differ in 545 keys and in the deployment identity. A
      devDependency edit in the root `package.json` re-keys all 223
      JavaScript-rendered entries. Severity Medium, effort Medium. Options:
      A, document that these are render inputs, effort not recorded; B, keep
      them in the compiled-code cache key, and compute the published
      document keys from folder-independent data: module digests by
      repository path, class maps, and bindings, Medium; C, make the bundle
      identity itself folder-independent, Large. Recommended: B.

- [ ] Resolve user item 134 (M11 plan TODO): event-loss recovery for macOS
      and Windows watches. Native watchers can drop events: macOS FSEvents
      batches, and Windows buffer overflows. Do the work after the first
      hosted macOS and Windows runs, with tests. The hosted native jobs do
      not pass yet, so no measurement exists. Severity Medium, effort Medium
      (estimate). Options: A, a repository-root rescan after each macOS
      batch and an exact-input stamp check on Windows, Medium (estimate);
      B, one recursive watch per root on both systems, effort not recorded.
      Recommended: A (estimate). This TODO replaces the M11 TODO "After the
      first hosted macOS and Windows runs, make event loss recoverable
      there", which held the same choice.

- [ ] Resolve user item 143 (89 B and 90 C review finding 2): a
      deployment spec never delivers its step failure. On
      `rebuild/viewer-90c`, `tests/browser/static_deployment_flow.spec.ts`
      lines 130 to 182 pass on the abort alone: the replacement aborts the
      step's load before its 404 can arrive. Severity Low, test, effort
      Small. Options: A, rename the test, reword its comment and
      `tests/browser/README.md` lines 82 to 88, and record and assert the
      abort, Small. Recommended: A.

- [ ] Resolve user item 144 (103 C review finding 2): Affected link tests
      do not check their axes. `tests/browser/branch_point_affected.ts`
      lines 126 to 193 take the expected viewport from the link itself, and
      `packages/viewer/tests/affected_comparison.test.ts` lines 134 to 168
      do not read the Affected link URLs. Severity Low, test, effort
      Medium. Options: A, add the expected viewport and scheme to the
      fixture, and assert the query and the Details text, Small
      (estimate); B, a shared helper with independent destination, axis,
      comparison, and Details expectations, Medium. Recommended: B.

- [ ] Resolve user item 150 (135 B review finding 42): Yarn Classic scripts
      survive a stop. Yarn Classic 1.22.22 starts dependency scripts in a
      new session on Linux and macOS, so the group signal misses them.
      Severity High, product bug, effort Large. Options: A, document it,
      effort not recorded; B, keep scripts off for Classic on Unix, with a
      warning, effort not recorded; C, the platform process owner stops
      every descendant, also in new sessions, Large. Recommended: C.
  - Security: the hub recommends a decision before the first npm release.

- [ ] Resolve user item 151 (135 B review finding 43): a script can read the
      publish token. A script reads `MOKLY_TOKEN` from Mokly's own
      `/proc/{pid}/environ`. Severity Medium, security, effort Small.
      Options: A, document it and advise `--no-base-install-scripts`,
      effort not recorded; B, keep scripts off when a token is present, with
      a warning, Small; C, a separate process space, effort not recorded.
      Recommended: B.
  - Security: the hub recommends a decision before the first npm release.

- [ ] Resolve user item 152 (135 B review finding 44, wider part): the
      scripts hint misses render failures. Severity Medium, effort Large.
      Options: B, show the hint where changes are classified, effort not
      recorded; C, a typed field and one helper, Large. Recommended: C.
      Option A is an auto-fix in progress.

- [ ] Resolve user item 153 (145 B probe): Yarn TLS file settings read
      outside files. Severity Medium, security, effort Small. Options: A,
      tier three when a base `.yarnrc.yml` sets `httpsCaFilePath`,
      `httpsKeyFilePath`, or `httpsCertFilePath`, Small; B, clear them,
      effort not recorded; C, confine them to the repository, effort not
      recorded. Recommended: A.
  - Security: the hub recommends a decision before the first npm release.

- [ ] Resolve user item 154 (135 B review finding 47): opt-in tests are
      missing. Severity Low. Recommended: B, an end-to-end test for each
      package manager. The 135 B review record holds the other options.

- [ ] Resolve user item 155 (135 B review finding 51): the scripts mode is
      stored in several places. Severity Low. Recommended: B, keep the mode
      on the install command. The 135 B review record holds the other
      options.

- [ ] Resolve user item 156 (135 B review finding 52): the hint has no
      final period. Severity Low. Recommended: A. The 135 B review record
      holds the options.

- [ ] Resolve user item 157 (135 B review finding 53): the scripts flags
      are ignored with `--no-changes`. Severity Low. Recommended: A,
      document it. The 135 B review record holds the other options.

- [ ] Resolve user item 158 (pnpm CI fix finding 1): pnpm recreates a
      tracked `node_modules` only under CI. A tracked
      `node_modules/.modules.yaml` that needs recreation fails locally with
      `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`, which gives tier three,
      but succeeds under CI, which gives tier two. Severity Medium, product
      bug, effort Small. Options: A, turn off the recreation prompt for
      private installs, Small; B, document the CI-dependent result, effort
      not recorded. Recommended: A.

- [x] Resolve user item 159 (release-lockstep review finding 1): fixed test
      versions block the first release PR. `tests/release_config.test.ts:64`
      requires version `0.16.0`, and
      `tests/public_export_ratchet_git.test.ts:214` requires the audit
      baseline `v0.15.0`, so the required tests of the first release PR
      fail. Severity High, test, effort Medium. Options: A, derive the
      expected versions from generated metadata and the selected tag, effort
      not recorded; B, fixed input fixtures for the exact-version tests, and
      live checks relative to generated metadata, Medium. Recommended: B.
  - Fix before the first npm release.
  - User decision 159 (2026-10-25): B. Fixed in `7dd50726`: the
    exact-version checks read fixed fixture inputs, and the live checks
    follow the release manifest, the package versions, and the reachable
    release tags. The sidecar hello test had the same pin and follows its
    package version now. Evidence: `.context/release-version-fixtures/`.

- [ ] Resolve user item 160 (W2 finding 1): Props and Usage Try again leave
      focus on the page. Severity Low, product bug, effort Medium
      (estimate). Options: A, document that a detail retry keeps the
      browser's focus, effort not recorded; B, move focus to the loading
      status, then to the panel heading, Medium (estimate). Recommended: B.

- [ ] Resolve user item 161 (W2 decision 2): a slot line calls a screen
      "this page". `packages/viewer/src/shell/workspace_props.tsx:163`
      differs from the design's "Supplied by Welcome." in
      `examples/basic/specs/design/components/parts/instance_details.tsx:81`.
      Severity Low, effort not recorded. Options: A, keep it; B, name the
      owner by its title, as the design does; C, a noun from the shared
      entry wording, with a design first. Recommended: B.

- [ ] Resolve user item 162 (batch 25 harness note):
      `npm run benchmark:large -- --scenario build` stops at its 300-second
      liveness deadline, but the large fixture builds with `--strict --base`
      take 467 s (HTML) and 921 s (React). Severity Low, effort not recorded.
      Options: A, raise the build scenario's deadline above the measured
      build times; B, make the deadline a liveness limit that each progress
      line resets. Recommended: B.

- [ ] Resolve user item 163 (final review R2): `git diff --check` reports
      trailing spaces in `packages/viewer/tests/serve_marker_documents.ts`,
      an exact-bytes Serve HTML fixture in a template string. No gate runs
      `git diff --check`. Severity Low, effort not recorded. Options: A,
      remove the six trailing-space lines and update exact-byte assertions
      if needed; B, add a narrow check exception for this fixture.
      Recommended: A.

- [ ] Resolve user item 164 (final review R3): six `ci.yml` checkouts keep
      persisted credentials (the `useblacksmith/checkout` default), so pull
      request code can read the checkout token from `.git/config`. The same
      setting is on `main`, the repository is public, and the token has
      `contents: read` only. Severity Medium, effort not recorded. Options:
      A, set `persist-credentials: false` on the six checkouts; B, add a
      policy test that rejects persisted credentials (a new gate, which needs
      the user's approval). Recommended: A, and B later if approved.

- [ ] Resolve user item 165 (native CI round 6 decision): under decision
      69 C, a base read starts one Git process per file when
      `core.autocrlf` is not false, and Git for Windows sets it to true by
      default. The round 6 record gives no severity. Options: A, document
      the cost, Small; B, use the raw batch also for paths whose attributes
      make checkout an identity, Small; C, convert each batch in one
      `git checkout-index --temp` process with a private index, and fall
      back per file on a failure, Medium. Recommended: C.

- [ ] Resolve user item 166 (native CI round 6): product code can still call
      `std::fs::canonicalize`, which returns the `\\?\` form on Windows that
      npm and Node reject: `crates/mokly-git/src/disk.rs:42` and
      `crates/mokly-sidecar/src/memory_table.rs:67`. Neither reaches Node
      now. Severity Low, effort not recorded. Options: A, keep the two calls;
      B, use `dunce::canonicalize` there and forbid `std::fs::canonicalize`
      in product code with a Clippy `disallowed-methods` rule (a new lint,
      which needs the user's approval). Recommended: B.

- [ ] Resolve user item 167 (W8 finding 1): a nested configuration with
      `"renderer": "../renderer.tsx"` gets no renderer stylesheet, because
      `crates/mokly-render/src/bundle_inputs.rs:26` and
      `crates/mokly-render/src/graph.rs:159` use the raw spelling while
      `crates/mokly-graph/src/styles.rs:180` links the normalized path. A
      probe confirmed it. Severity Medium, product bug, effort Large for B.
      Options: A, normalize the renderer path at the two render call sites,
      Small; B, add one public `ResolvedConfig` method that returns the
      normalized form of a config-relative path, and use it for the
      renderer, the PostCSS module, and the configured stylesheets in the
      render crate, Large, which also fixes 169 and 170. Recommended: B.

- [ ] Resolve user item 168 (W8 finding 2): the manifest rule
      (`crates/mokly-catalogue/src/config_paths.rs:210`, `has_manifest`) now
      accepts two rare roots that the base rejected: a link before `..`
      where only the normalized root holds `package.json`, and a file before
      `..`, such as `file.txt/../ui`, which then fails in `mokly build` with
      an I/O "resolve" error. Severity Low, effort Small. Options: A, the raw
      spelling decides when the source tree can resolve it, and the
      normalized root decides only when that lookup fails, Small, with the
      reviewer's auto-fix tag; B, A, and the output boundary also skips an
      alias it cannot resolve, Small; C, reject a root whose physical target
      differs from its normalized root, a new rejection, see 171; D, resolve
      each root once into one record that the manifest rule, the file
      policy, and the output boundary read, Large. Recommended: A.

- [ ] Resolve user item 169 (W8 finding 3): a configured stylesheet spelled
      `sub/../first.css` fails a component build with "listed authoring
      input" (`crates/mokly-render/src/declarations.rs:35`). Severity Low,
      effort Large for B. Options: A, normalize the configured list there,
      Small; B, the method of 167 B, Large. Recommended: B.

- [ ] Resolve user item 170 (W8 finding 4): PostCSS load errors show
      `tools/../postcss.mjs` instead of `postcss.mjs`
      (`crates/mokly-render/src/stylesheets.rs:63`, `postcss.rs:131`).
      Severity Low, UX wording, effort Large for B. Options: A, normalize
      before the sidecar call, Small; B, the method of 167 B, Large.
      Recommended: B.

- [ ] Resolve user item 171 (W8 decision 5): in a spelling such as
      `link/../ui`, where `link` is a symbolic link, one package root has two
      meanings: the normalized root and the physical target. `80a8a195`
      keeps the base behaviour through
      `ResolvedConfig::package_root_aliases()`. Severity Low, effort not
      recorded. Options: A, keep it and add one sentence to the
      configuration page, which is at its cap, so it needs a split; B, use
      only the normalized root and remove the aliases, so such a spelling
      fails with the existing "must contain package.json" message, which
      also closes 168; C, reject such a spelling with a new message.
      Recommended: B.

- [ ] Resolve user item 172 (W8 decision 6): a Rust test that compares
      joined paths as `/` strings fails only on Windows. Severity Low,
      effort Small. Options: A, keep the convention of comparing `Path`
      values, which the hosted Windows job enforces, Small; B, a shared test
      helper that compares path lists by components, in a new shared test
      crate, Large. Recommended: A.

- [ ] Resolve user item 173 (W8 decision 7):
      `crates/mokly-compare/tests/large_sources_tests.rs:17` runs `git`
      without the isolated `support::git`, so a global setting such as
      `commit.gpgsign = true` can fail it locally. Severity Low, effort
      Small. Options: A, use `support::git`, Small; B, A, and add a check
      that rejects `Command::new("git")` in Rust tests outside the support
      modules (a new gate, which needs the user's approval). Recommended: A.

- [ ] Resolve user item 174 (W8, outside its scope):
      `crates/mokly-compare/src/git_tree.rs:214` reports a symbolic-link
      entry as `Symlink`, so a package root that is a link, or goes through
      one, loads in the working tree but fails in the base tree. Severity
      Low, effort not recorded. Options: to be written in the follow-up.

- [x] Resolve user item 175 (W1 example smoke): the documented mockup check
      (`npx mokly build --config examples/basic/mokly.config.json --strict --out ../../.context/example`)
      fails under `--strict` whenever a branch's root dependency files differ
      from `origin/main`: "Base dependencies differ. HTML comparison uses
      working-tree dependencies." The comparison spec makes that warning fail
      a `--strict` build. Severity Low, process, effort not recorded. Options
      (estimate): A, add `--no-changes` to the documented check; B, document
      that the check needs `--no-changes` when the root dependency files
      differ; C, stop that warning from failing `--strict`, a spec change.
      Recommended: B.
  - Settled by user decision 183 (2026-10-23): C. This item is the same
    class, and its option C is that change: every `base-dependencies`
    warning stops failing `--strict`. Fixed in integration batch 33 by
    `421d604d`.

- [ ] Resolve user item 176 (delta review 1):
      `crates/mokly-platform/tests/process_tests.rs:104`: the Windows
      job-close test cannot fail when the job does not kill the child,
      because `Child::wait` closes stdin, so `set /p` ends cmd by itself.
      Severity Medium, test, effort not recorded. Options (estimate): A,
      append `&echo leaked` to the command and assert that it never prints;
      B, a shared test helper that proves the job killed the child, used by
      every job-close test. Recommended: A.

- [ ] Resolve user item 177 (delta review 2):
      `crates/mokly-publish/src/redaction.rs:85`: `SecretMatcher` reads every
      `%` as an escape, so it does not redact the literal form of a secret
      that contains `%`. The old redactor did. A valid token cannot contain
      `%`. Severity Low, security, effort not recorded. Options (estimate):
      A, also match a literal `%` byte; B, keep it and document that a token
      cannot contain `%`. Recommended: A.

- [ ] Resolve user item 178 (delta review 3):
      `crates/mokly-publish/src/completion.rs:69`: the check reads the parsed
      URL, and URL parsing lowercases the host, so a token in the viewer URL
      host prints in lower case. The old check had the same gap, and no test
      covers a token in the host. Severity Low, security, effort not
      recorded. Options (estimate): A, match the token in the host without
      regard to letter case, with a test; B, reject a viewer URL whose host
      contains the token (a new rejection, which needs the user's approval).
      Recommended: A.

- [ ] Resolve user item 179 (delta review 4):
      `crates/mokly-compare/src/locations.rs:40`: `dunce` keeps the verbatim
      `\\?\` form for a path over 260 characters or with a reserved name, so
      the "cache inside the repository" check can compare a verbatim path
      with a plain path. It misses only when `LOCALAPPDATA` points into the
      repository through such a path. Severity Low, product bug, effort not
      recorded. Options (estimate): A, normalize both paths the same way
      before the comparison; B, document the limit. Recommended: A.

- [ ] Resolve user item 180 (delta review 5, older than the delta):
      `crates/mokly-sidecar/src/process_factory.rs:82`: the sidecar inherits
      `MOKLY_TOKEN`, so PostCSS, renderer, and component code from the
      repository and from the base commit can read it. `main` ran that code
      with the same environment. Related to user item 151. Severity Low,
      security, effort not recorded. Options (estimate): A, remove
      `MOKLY_TOKEN` from the sidecar environment; B, an allowlisted sidecar
      environment, as 145 B gives base installs. Recommended: A, because an
      allowlist can break consumer PostCSS settings that read other
      variables.

- [ ] Resolve user item 181 (delta review 6, older than the delta):
      `crates/mokly-cli/src/grammar.rs:116`: `Publish` derives `Debug` and
      holds the raw `--token` value. No code formats it now. Severity Low,
      security, effort not recorded. Options (estimate): A, a redacting
      `Debug` for `Publish`; B, one secret type with a redacting `Debug` for
      every token field. Recommended: B.

- [ ] Resolve user item 182 (delta review 7, older than the delta):
      `crates/mokly-render/src/side.rs:62` keeps duplicate package roots, but
      `crates/mokly-compare/src/dependencies.rs:191` removes them on the base
      side. With `packageRoots: [".", "packages/ui"]` in a root
      configuration, `packages/ui` gets root index 2 on the head and 1 on the
      base. No visible effect was checked. Severity Low, product bug, effort
      not recorded. Options (estimate): A, remove duplicates on the head side
      too; B, make `ResolvedConfig::package_roots()` return the list without
      duplicates for both sides. Recommended: B.

- [x] Resolve user item 185 (docs): 157 tracked Markdown files, 129 of them
      protocol pages, still start with
      `Status: In progress under the Rust rebuild plan`, but the
      documentation policy removes that line when the behaviour is
      implemented, and no plan TODO removes them. Severity Medium, docs,
      effort not recorded. Options (estimate): A, sweep every page and remove
      the line where the behaviour is implemented; B, also add a check that
      fails on a Status line whose behaviour the plan marks complete (a new
      gate, which needs the user's approval). Recommended: A.
  - User decision 185 (2026-10-26): A, as finding 6 of the documentation
    skill audit. The sweep removed the line from 151 pages and kept it on 7
    protocol pages whose behaviour is not implemented: `ci-test-timing.md`
    (the wider clock lint), `dependency-security.md` (item 191),
    `mokly-imported-styles-modules.md` (item 111), `mokly-terminal-errors.md`
    (item 152), `mokly-on-demand.md` (React startup), and
    `mokly-catalogue-delivery.md` and `mokly-documents.md` (`relatedDocs`
    references that no producer writes). The status-line rule moved from the
    deleted documentation policy into `AGENTS.md`.

- [ ] Resolve user item 186 (docs): short summaries still say that
      `--strict` makes warnings fail, but `base-dependencies` no longer
      counts (183 C). The exception is stated once, in
      `mokly-build-warnings.md` Strict Mode. The summaries:
      `README.md:155` and `:161`, `docs/guides/start/build.md:52`,
      `docs/guides/cli/check.md:16`, `docs/guides/cli/build.md:26`,
      `docs/guides/cli/publish.md:33` and `:79`,
      `docs/guides/cli/serve.md:66`, `docs/guides/authoring/screens.md:216`,
      `docs/protocol/mokly-upload.md:58`,
      `docs/architecture/build-pipeline.md:114` (page merged into
      `docs/architecture/rust-core.md` on 2026-10-26 without this summary), and
      `examples/basic/specs/design/library/README.md:192`. The second delta
      review found more: `docs/guides/cli/options-and-exit-status.md:51`,
      `docs/protocol/README.md:19`, `docs/protocol/mokly-export.md:37`,
      `:129`, and `:235`, `docs/protocol/mokly-runtime.md:91`,
      `docs/protocol/mokly-package.md:88`,
      `docs/protocol/mokly-terminal-help.md:90`, and the CLI help in
      `crates/mokly-cli/src/grammar.rs:97` and `:123` (the `publish` help
      says "Fail on every build warning before uploading."). Severity Low,
      docs, effort not recorded. Options (estimate): A, name the exception
      or link to Strict Mode in each summary that states the rule; B, keep
      one home for the exception. Recommended: A.

- [ ] Resolve user item 188 (process): the local executor gate on
      `a59b16f1` took 114 of its 120-minute detach limit (batch 31: 86
      minutes), so a later local gate can pass the limit. Severity Low,
      process, effort not recorded. Options (estimate): A, raise the detach
      limit for local gates in the delegate rules to 3 hours; B, find the
      slowest suite and reduce its cost. Recommended: B.

- [x] Resolve user item 189 (product, the wider fix of 187): a comparison
      `review.json` grows with every rule record of every added or changed
      view, and each record repeats the full stylesheet path. A static host
      with a per-file limit, such as Cloudflare Pages with 25 MiB, then
      rejects a large comparison. Severity Medium, product, effort not
      recorded. Options (estimate): A, keep the compact file; B, a smaller
      review format, for example one stylesheet table that rule records
      reference (a new review format version; Large); C, split
      `review.json` into files per entry (a new format version; Large).
      Recommended: B.
  - The 2026-10-26 discussion added two options. D keeps a small
    `review.json` summary for receivers only. E removes `review.json`: the
    index and the entry details carry its data, and the Plan request sends
    the index. Mokly Cloud reads `review.json` on its server but still
    parses review v6 only, so it must change in either case.
  - User decision 189 (2026-10-26): E. The
    [remove the review file plan](./remove-review-json.md) carries out the
    work, including the Mokly Cloud change.

- [x] Resolve user item 190 (PR #200 strict audit): three `undici`
      advisories and a stale `braces` exception failed the strict
      dependency audit of PR #200 and release PR #201.
  - User decision 190 (2026-10-25): A. An npm `overrides` entry sets
    `undici` 7.30.1 for `miniflare`, and the stale `braces` exception is
    removed, in PR #200 (`72cbbd90` and `006a49c4`). This record merges
    with PR #200.

- [ ] Resolve user item 191 (docs): `docs/protocol/dependency-security.md`
      names "Cloudflare local static-host checks" for the `wrangler` pin,
      but no test or script runs `wrangler` or `miniflare`. Severity Low,
      docs, effort not recorded. Options (estimate): A, remove the phrase;
      B, add a test that serves a built site with `wrangler pages dev`
      (Medium; every gate starts the local Cloudflare runtime).
      Recommended: A.

- [ ] Resolve user item 192 (test):
      `tests/static_base_manager_mirror.test.ts`, "a cold Yarn Classic base
      installs ordinary versions from its committed offline mirror", fell
      back to tier 3 instead of tier 2 once on hosted CI (PR #200 run
      40194214551, attempt 1) and passed on the rerun. Severity Low, test,
      effort not recorded. Options (estimate): A, find the cause from a
      reproduction with the manager output captured; B, also print the
      manager output in the failure message. Recommended: A.

- [x] Resolve user item 193 (test):
      `crates/mokly-sidecar/src/_tests_/pool_release_timing_tests.rs:90`
      sometimes recorded no `sidecar.stop` span (integration batch 32 on
      Linux; PR #200 run 40194214551 on hosted macOS, attempts 1 and 2).
      Severity High, test.
  - User decision 193 (2026-10-25): B. Fixed in its own pull request by
    `298ede89`: the shared trace capture installs one global dispatcher
    that keeps every callsite's interest at `sometimes`, so a callsite
    that a thread without a capture registers first cannot cache `never`.
    Evidence: `.context/sidecar-release-trace/`.

- [x] Resolve user item 194 (plan): the status paragraph still named user
      item 159 as High and open after its fix.
  - User decision 194 (2026-10-25): A. The clause is removed in the same
    commit as this record.

- [x] Resolve user item 195 (merge): PR #202, the fix of user item 159.
  - User decision 195 (2026-10-25): A. PR #202 merged as `6d9705aa`.

- [ ] Resolve user item 196 (Medium, test; open):
      `crates/mokly-cli/src/_tests_/serve_trace_tests.rs` and
      `crates/mokly-graph/tests/routing_work_tests.rs` capture spans with
      scoped subscribers, as the sidecar trace capture did before the fix of
      user item 193. A span can then be lost while parallel tests register
      and drop their subscribers. Options (estimate): A install the same
      once-per-process interest guard in both captures (Small); B leave
      them until one of them flakes. Recommended: A, in a separate branch.

- [ ] Resolve user item 197 (Low, process; open): the shared-version
      check in `scripts/release/versions.mjs` still accepts CLI 0.15.0 with
      viewer 0.6.0, the pair before the lockstep migration. No release can
      return to that pair after 0.16.0. Options (estimate): A remove the
      exception, so that the check requires one shared version (Small); B
      keep it. Recommended: A. Removal needs the user's approval, because
      the check is release functionality.

- [x] Resolve user item 200 (release): release run 40254485539 failed at
      `npm publish` with a 404 for `@mokly/native-linux-x64-gnu`. The five
      `@mokly/native-{target}` packages do not exist on npm, and trusted
      publishing needs an existing package. Nothing was published.
  - User decision 200 (2026-10-26): B. A one-off read-only workflow,
    `.github/workflows/native-bootstrap.yml`, runs the bootstrap command for
    the five targets on the hosted runners and uploads each registration
    archive with its source reports. Branch
    `rebuild/native-bootstrap-workflow` (`83dfb875`); this record merges
    with its pull request. Local `linux-x64-gnu` proof:
    `.context/native-bootstrap-proof/`.

- [x] Maintainer steps of user decision 200, after its pull request merges:
      dispatch the native bootstrap workflow for a reviewed commit, publish
      the five registration archives, configure the five trusted publishers
      and verify the two existing ones, then rerun the failed publish job of
      release run 40254485539.
  - Done on 2026-10-26. Bootstrap run 40307321788 built the five archives
    from `c84be6c4`. They were published as `0.0.0` under `bootstrap`, and
    each new package also shows npm's `0.0.0-stage` staged-publishing
    placeholder. The five trusted publishers name `mokly-ai/mokly`,
    `release.yml`, and environment `npm`, and the CLI and viewer publishers
    read back the same. Each native package requires 2FA and disallows
    tokens. The rerun published two native packages, then stopped at the
    registry verifier: user item 205.

- [x] Resolve user item 201 (Low, process): the native bootstrap workflow
      accepts any well-formed 40-character commit SHA, also one that `main`
      does not contain. Options (estimate): A keep the format check,
      because the maintainer compares `sourceCommit` in each report with the
      reviewed commit; B add a containment check, a new rejection.
      Recommended: A.
  - User decision 201 (2026-10-26): A. The workflow keeps its format check
    only, and the code does not change.

- [x] Resolve user item 202 (test): the nightly Design Attribution Matrix
      failed on `main` (schedule run 40295914111 on `c84be6c4`) with
      compile error E0061. `crates/mokly-cli/tests/design_support/native.rs`
      passed seven arguments to `changes_runtime::service`, which takes
      eight since #199. The repository suite linted the workspace without
      the `design-matrix` feature, so no gate compiled the target.
  - User decision 202 (2026-10-26): B. The design support passes
    `common.base_install_scripts_override()` (`439f2601`), and the
    repository suite also runs
    `cargo clippy -p mokly-cli --features design-matrix --all-targets -- -D warnings`
    (`21876714`). Branch `rebuild/design-matrix-compile`. The full matrix
    passed on the branch in run 40312840294.

- [x] Resolve user item 205 (release): the rerun of the 0.16.0 publish job
      published `@mokly/native-linux-x64-gnu@0.16.0` and
      `@mokly/native-linux-arm64-gnu@0.16.0`, then stopped. The registry
      verifier installed the arm64 package on the x64 publish runner, and
      npm rejected it with `EBADPLATFORM`, because npm applies `--os` and
      `--cpu` only to optional dependencies. Every retry of 0.16.0 runs the
      scripts of the `v0.16.0` tag.
  - User decision 205 (2026-10-26): A. The verifier installs a native
    package as an optional dependency with its os, cpu, and libc
    selectors, in branch `rebuild/native-verify-platform` (`1fd02a4a`).
    0.16.1 replaces 0.16.0, which stays incomplete on npm. The rejected
    option B finished 0.16.0 from its retained archives through a
    temporary workflow setting.

- [x] Release steps of user decision 205, after its pull request merges:
      merge the 0.16.1 release pull request when its checks pass, then
      verify all seven packages at 0.16.1 on npm.
  - Done on 2026-10-26. PR #207 merged as `66e1ba6a`, and release PR #208
    merged as `713f9b38`. Release run 40364686121 published all seven
    packages at 0.16.1 under `latest`, with the tags `v0.16.1` and
    `viewer-v0.16.1`.

- [x] Resolve user item 206 (plan): the plan still showed the 0.16.1
      release steps as open, and user items 196 and 197 were not in the
      plan.
  - User decision 206 (2026-10-26): A. This plan-only change ticks the
    release steps and records items 196 and 197.

- [ ] Follow-up (Low, not a user item): `CapturedPool` in
      `crates/mokly-render/tests/integration/support.rs` unwraps its `calls`
      mutex. A test that fails while it holds the lock poisons the mutex, and
      a later unwrap then aborts the test binary and hides the failure
      messages. Use the poisoned value.

- [ ] Follow-up (Low, cost, not a user item): move the Linux CI jobs that
      compile Rust back to 2 vCPUs. On 2026-10-26 the user raised them from
      2 to 8 vCPUs for a limited time, until the Rust build cache of #215 and
      the other CI speed work land. The Windows native job stays on 8 vCPUs.
      On 2026-10-27 the user chose 8 over 16 vCPUs for it, because with the
      Rust build cache 16 vCPUs gave no speed-up. On 2026-10-27 the user also
      asked that the remote gate's Testboxes match the CI suite jobs and stay
      aligned, so that a remote gate takes the time and cost of CI. The
      Testbox job therefore moves back with the Linux jobs. Measure the cached
      job times on 2 vCPUs first. Update `docs/protocol/ci-workflow.md`,
      `docs/protocol/remote-verification-testbox.md`, and the runner size test
      in the same change.

- Outside the W2 review scope: `packages/viewer/src/shell/workspace_evidence.tsx:143`:
  "Page details or saved examples changed." shows on screens. Separate
  branch.
- Outside the W2 review scope: `tests/browser/react_comparison_evidence.spec.ts:70`:
  about eight test titles call a variant a "saved view". Separate branch.
- Outside the W2 review scope: `examples/basic/specs/design/browse/loading/screens.tsx`:
  the Loading and recovery designs show the preview in the stage, but the
  product shows "Loading preview…". Separate branch.
- Outside the 200 B scope: `tests/npm_pin.test.ts:48` matches only an exact
  `npm ci` command, so it skips `npm ci --ignore-scripts`. Separate branch.
- Outside the 200 B scope: `docs/protocol/npm-bootstrap.md:145`: the older
  sections name a test file and describe how the code works, against the
  documentation rules. Separate branch.
- Outside the 117 C port review scope: `scripts/release/package_reports.mjs`:
  the required CLI file list does not name `dist/sidecar/parent-watchdog.js`,
  which `packages/mokly/src/sidecar/parent-input.ts` loads by path. Separate
  branch.

## Rebuild procedures

These procedures moved here on 2026-10-26 from
`docs/protocol/rust-rebuild-procedures.md`, which the documentation
alignment removed because a procedure of a completed plan is not a
protocol requirement.

### Reference Capture

Run once before the teardown, from the `ts-backend-final` tag, with the old
CLI built from that tag. Save everything under `.context/rust-rebuild/reference/`,
which Git ignores. The references are guidance, not an oracle: the Rust core
may differ where the spec says so.

Scenarios, one directory each:

| Directory          | Repository state                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `example`          | the example catalogue at the tag, built, served, and exported                                                                             |
| `large/<scenario>` | the large fixture's four benchmark scenarios                                                                                              |
| `moved-screen`     | the example with one screen file moved and its `movedFrom` hint absent                                                                    |
| `removed-screen`   | the example with one screen deleted                                                                                                       |
| `markdown-edit`    | the example with one document's body changed                                                                                              |
| `ignore-edit`      | the example with a change inside a paired Review-ignore region only                                                                       |
| `stylesheet-edit`  | the example with one changed rule that matches rendered elements and one changed rule that matches none, in a stylesheet that screens use |
| `renderer-change`  | the example with a renderer edit that changes head styles for every screen                                                                |

For each scenario keep the review artifact, the catalogue read model, the
export inventory, and the terminal output of build, check, serve startup, and
export; the previous manifest and generated tree are not kept, because the
Rust core writes neither. Then run
the behaviour-table script, `scripts/rebuild/behaviour-table.mjs` on the
rebuild branch, over the saved outputs. The JSON table contains `availability`
fields for captured inputs, entries by kind and path, listed changes with
states and reasons, affected consumers, kept rules and excluded stylesheets
per view, `exportedResources` paths and sides, and resource closures per view.

### Gap Sweep

Each Rust subsystem replacement runs one bounded sweep before its milestone
closes. The sweep is a reading exercise against the previous protocol and the
old test names, not a port.

1. List the previous protocol pages and the test files that owned the
   subsystem, read at the commit the plan names.
2. List every assertion of each old test, including its helpers and its host
   branches, and every section of each old protocol page. Mark each one as
   proved or not proved, and check that the title of each port states what
   the port proves.
3. For each rule or test case, decide one of three outcomes with one line of
   reason: adopt, adopt with a change, or drop.
4. Write the adopted and changed rules into the new spec page in the same
   change. Dropped rules need no record beyond the sweep file.
5. Produce the behaviour table from the Rust core for every captured scenario
   and compare it with the reference table. Put each difference into one bin:
   an improvement the spec already states, a spec gap to close before the
   milestone closes, or a regression to fix.
6. Save the sweep and the comparison under
   `.context/rust-rebuild/sweeps/<milestone>.md` and name that file in one
   line under the milestone in the plan.

Each sweep override lists the old checks that its port does not prove.
If a delegate drops a duplicate row, the delegate moves those checks into
the kept port.

Accepted differences are listed in the breaking-change release note. A
regression blocks the milestone.
