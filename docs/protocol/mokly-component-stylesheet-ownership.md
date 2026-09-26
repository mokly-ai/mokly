# Component Stylesheet Ownership And Comparison

## Delivery Status

The provenance, final-link ownership and comparison rules below were planned
by [remove-source-path-evidence](../../plans/remove-source-path-evidence.md)
and implemented in Milestone 13. The structured warnings were implemented in
Milestone 14. Declaration, validation and placement
remain in [component stylesheets](./mokly-component-stylesheets.md).

## Provenance And Comparison Material

Mokly must distinguish only the links it inserts from renderer-authored links,
including renderer links reused for ownership. Give each inserted link a
unique transient `data-mokly-component-stylesheet` token before the optional
compatibility transform. The attribute is reserved: a renderer-authored
occurrence fails `build-invalid` because provenance would be ambiguous. The
token is the zero-based decimal ordinal of an inserted link in that document.
A transformer retaining an inserted link retains its token; removing or
replacing the link may remove the token. An unmarked replacement, including
the same href with its token stripped, is authored page content. Each token
may survive exactly once, on a stylesheet link to its original real file;
duplicates or reassignment fail `build-invalid`. After transformation, scan
the final document, resolve marked links to declared real files, remove the
transient attribute, and store their full-link UTF-16 spans, public paths and
rendered declaring component ids in the private v6 view's
`insertedStylesheets` record. Final HTML has no token or wrapper, so the
rendered page is unchanged. Offsets refer to final HTML including its generated
header. Validate spans against those bytes and rebase range/style offsets
through attribute removal. Remove the attribute and its leading space without
reserializing the link. A removed link produces no span. Old v6 baselines
without this optional record conservatively retain all links as page content;
never guess provenance. The first comparison to such a baseline may show a
link-only migration change.

For page comparison material, remove recorded full-link spans from both
documents **before** component projection and paired or single Review-ignore
normalization. Rebase a comparison-only copy of range/style offsets through
that removal; never change the stored final-document offsets. Do this on the
complete path and before the unchanged-view fast decision's equality checks.
On a component page, retain a recorded link when its owners include that
page's root component id, even if a child also owns it; remove child-only
inserted links. A screen has no root exception. Renderer-authored and
compatibility-authored links stay page content, even when their files have
derived ownership. Public output and snapshots keep the final documents.
Resource discovery and CSS rule matching use those final documents with their
normal Review-ignore policy, **without** stripping inserted links. Thus
provenance affects page material only, not file-content evidence or owners.

## Derived Ownership And Conflicts

For every real file linked through a declaration, Mokly adds exactly one record
to the current view's `ComponentViewRecord.resources`:

```ts
interface ComponentResourceOwnership {
  path: string; // mockupsDir-relative public CSS file
  componentIds: readonly string[]; // nonempty, sorted, unique ids
}
```

Owners are exactly the rendered component ids declaring that real file (including
the component root when applicable). Merge declarations from repeated
instances/owners and realpath aliases of one file. When a configured link to
that file remains in the final document, its decoded public path is the record
path; otherwise use the first matching final link's decoded public path. Sort
records by that path and ids by the manifest's lexical order; retain the
separate link position. Never infer ownership from selectors, a configured
link alone, or an import. Imported files remain unowned even when reached
through a declared stylesheet.

Renderer-supplied `styles` offsets and `resources` records still own other
material. Ignore a renderer `resources` record for any declared real file on
every page, even without a rendered declarer, and issue the
[owner-record warning](./mokly-build-warnings.md#exact-messages). Do not
validate its asserted component owners or merge it; it cannot grant
ownership. Resolve the record's confined public path to establish real-file
identity first; malformed or unsafe paths still fail normal validation.
Validate other resource records against existing public-root and conflicting-
owner rules. After compatibility transformation, rescan final stylesheet
links recognized by normal resource discovery, by real file. Keep one derived
owner record only for a declared file still directly linked in the final page;
remove it if all its links disappeared. If an inserted link was removed but
another final authored link to the same file remains, keep the owners and use
that link's decoded public path. Derived records are private to manifest v6,
not a public catalogue field.

## Changes

An edit to a declared stylesheet follows the same rendered-resource and CSS
rule analysis as any linked public CSS file. Ownership attributes retained
evidence to the declaring component(s); actual consuming screens/components
are listed under Affected screens rather than added to Changes solely because
they use that component. A changed import remains an unowned rendered resource
unless another explicit renderer ownership record applies. A declared file
that no current or baseline view links does not itself add an entry to Changes.
See [component changes](./mokly-component-changes.md) and
[CSS attribution](./mokly-css-attribution.md).
