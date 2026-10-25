# Rebuild Reference Tables

`behaviour-table.mjs` reduces a captured scenario to a sorted JSON table:

```bash
node scripts/rebuild/behaviour-table.mjs /absolute/scenario
node scripts/rebuild/behaviour-table.mjs /absolute/scenario /absolute/table.json
node scripts/rebuild/behaviour-table.mjs /absolute/rust-scenario --adapter=rust
```

The default output is `behaviour-table.json` inside the scenario directory.
Schema 2 contains entry kinds and paths, Changes states and reasons, affected
consumers, CSS evidence per view, exported resources, and resource closures.
It excludes commits, timestamps, deployment ids, artifact generation names,
file hashes, rule hashes, and instance hashes. Arrays are sets. Arrays and
object keys use code-unit order.

`behaviourTable(input, adapter)` accepts an explicit adapter. The adapter
returns the neutral `BehaviourRecords` type in `behaviour-table.d.mts`.
`adaptLegacyScenario` reads catalogue v6, review v7, export ownership v3,
and captured closures. `adaptRustScenario` reads index v7, detail v2, and review v8.
`readScenario` loads the legacy capture files. `readRustScenario` also loads
`entry-details.json`, the array of separately captured detail records. Missing files produce empty
sets and false `availability` fields. Invalid JSON and unsupported versions
fail with an error.

The adapter maps each field. A kept rule key is the JSON tuple of its resource
path and sorted unique selectors. Owners use entry kind and path, plus the
selectors attributed to that owner. Rule statuses are `applies` (a selector
hits rendered elements), `uncertain` (conservative retention), or
`resource-change` (a dependency without selector evidence). Excluded
stylesheets use `no-selector-hit`. An affected-consumer chain keeps component
paths and their depth; it does not compare instance identifiers.
Component variant contexts keep the parent path and a separate `variantPath`.
The Rust adapter derives both from that side's declared variant address,
including moves between parents, added variants, and removed variants.

The inventory contributes `exportedResources`: resource paths and sides,
without size or digest fields. It excludes shell files, viewer runtime files,
and generated entry HTML. It normalizes the same prefixes as the closures.
A missing inventory is distinct from an inventory with no authored resources.

## Resource Closure Contract

Capture scripts live beside the reference `README.md` under the ignored
`.context/rust-rebuild/reference/` directory. `closures.mjs` computes
`resource-closures.json` before the generated export tree is discarded.

- Start at each exported entry HTML document under
  `static/mokly-generated/` (after) or
  `mokly-viewer/diffs/generations/{generation}/snapshots/before/mokly-generated/`
  (before). Match the entry against current, previous, or removed paths.
- Screens and components take viewport and colour scheme from their document
  name. A screen or component document without a colour-scheme suffix uses
  `light`. Other entries have no viewport; a filename suffix gives their colour
  scheme, or the colour scheme is null when no suffix exists.
- Read HTML resource references and CSS imports and URL references. Resolve
  relative references against the containing file. Resolve `/static/` against
  the export root. Ignore external URLs, fragments, and `/mokly-viewer/`
  runtime references injected into a document.
- Traverse only targets present in the export inventory. Read HTML and CSS
  references transitively. Keep local leaf resources, including fonts and
  images. Exclude the starting document. Visit each target once, so cycles
  terminate.
- Strip `static/` or the snapshot generation prefix, then strip
  `mokly-generated/` when present. Keep paths relative to the authored output
  root. Sort and deduplicate resources. Keep before and after as separate
  rows keyed by entry kind, path, viewport, colour scheme, and side.

Missing generated files fail closure capture. A partial capture records that
failure and omits closures; it does not report an empty successful traversal.
