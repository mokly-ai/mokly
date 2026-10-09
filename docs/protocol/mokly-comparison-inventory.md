# Comparison Inventory And Post-Render Edits

## Delivery Status

This is the approved target in
[Generated Output Simplification](../../plans/generated-output-simplification.md).
The [v10 baseline contract](./mokly-baseline-addressing.md) owns historical roots.

## Per-Side Readers

Construct one inventory reader for each comparison side. The base reader uses
the accepted v10 `generatedFiles`, `assetClosure` and historical descriptor.
The head reader uses the accepted in-memory output and checked authored closure.
All full/selected comparisons, live Changes, component fast paths, resource
counterpart reads and removed-preview capture use these same side decisions.

A safe normalized path absent from that side's inventory is absent; do not try
to read it, apply another side's root or raise an invalid-resource error merely
because the corresponding file exists on the other side. A listed file that is
missing, nonregular, protected, unreadable or has invalid bytes is invalid and
retains the caller's typed failure. An unsafe or escaping path is invalid even
if unlisted. Required references on a side still require a valid target there.
Optional counterpart reads return absence only for a file not listed on that
side. Never turn corrupt listed data into a deletion.

Pair added, removed and renamed documents/resources using each side's own
inventory and root. Embedded generated pages follow the same rule as screens,
stylesheets, copied assets and authored closure files. Preserve binary bytes,
hash validation, normalized ignored regions and resource/anchor security.

Catalogues without registered components retain targeted baseline reads: read
the manifest and only the selected/changed view and resource evidence needed
for classification. Do not bulk-read all baseline generated HTML to classify
a small change. Remove both the head's and base's generated roots from Git
changed-path evidence; those bytes are already compared by the inventory
readers. Do not remove authored source changes during a catalogue-root move.

## Cache Acquisition And Discovery

Before publishing an entry lock, recreate its entry directory through the
existing confined filesystem boundary. If retention removes that directory
between creation and lock publication, retry only ENOENT, at most three attempts
per acquisition. Recheck cancellation before each attempt. A third race fails
with the existing typed preparation failure; other filesystem failures propagate
immediately. Do not interpret a missing parent as lock contention or remove a
different process's lock. Preserve existing lock wait deadlines and ownership.

After rebuilding, prefer a valid v10 catalogue at the requested root. During a
bounded moved-root search, count valid v10 candidates separately from recognized
earlier envelopes. Exactly one v10 candidate wins even when stale pre-v10 files
remain elsewhere, including at the requested root. Multiple v10 candidates keep
the exact ambiguity failure. With no v10 candidate, exactly one earlier candidate
keeps `baseline-incompatible-earlier`; zero or several candidates retain the
existing ambiguity error. Malformed/newer data is never an earlier result.
Do not read earlier entries, normalize old layouts or cache incompatibility.

## Post-Render Offset Mapping

Every operation that edits rendered HTML returns its exact nonoverlapping text
patches against its input string. Represent a patch with start/end offsets and
replacement text; offsets count JavaScript UTF-16 code units. Apply patches in
source order and use one shared offset map to translate recorded style ranges
through each stage. Insertions before a style shift both boundaries; replacing
a disjoint earlier span shifts them by its byte-independent text-length delta.
Reject overlapping patches or an edit that destroys a recorded style boundary.
Do not pair styles by position, count `<style>` tags or infer offsets by matching
repeated stylesheet text.

Link-control adaptation and logical-link rewriting report their patches to this
map. Preserve unchanged bytes and current source/range authentication. A new
package link-control stylesheet in `<head>` cannot claim a component's existing
body style or change its ownership. Build and requested Serve compilation use
the same mapping for all component views.

Public details contain no source dependency list. `sourcePath` stays
repository-relative display metadata and never supplies comparison evidence.
Markdown resource inventories remain private validation inputs. Ready public
view/page `resourceEvidence` comes only from accepted rendered-resource and
CSS-rule proof. Display projection is a reader-side shell representation,
not a current CLI catalogue producer.

## Acceptance

Write failing tests for adding/removing/renaming generated embedded pages and
every resource kind through Review and live Changes. Test an absent counterpart
separately from a listed-but-missing or corrupt resource. Spy on screen-only
baseline reads to prove the selected scope. Test moved catalogue roots with
head/base generated Git changes and unchanged authored paths.

Use deterministic filesystem interleaving for the cache-directory removal race,
then test success, exhausted retries, other failures and cancellation. Test a
unique moved v10 catalogue plus stale root v7, multiple v10 candidates, and an
actual pre-v10 rebuild with no v10 result.

Add SHA-256 repository and binary Git-blob baselines. Retain Serve's exact
earlier-version line, once per base and reset on a changed base. Test a component
body `<style>` with `MockLink asChild`, several identical styles, head insertion
and logical-link replacement through Build and Serve. Verify ownership offsets
point to the original component style after each edit. Smoke-test Changes after
adding and removing an embedded generated page.
