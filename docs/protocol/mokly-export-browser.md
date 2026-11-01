# Static Build Browser And Identity

This page supplements [Static Delivery](./mokly-export-delivery.md) with the
standalone browser inventory and the deployment identity algorithm that the
[shell delivery contract](./mokly-shell-delivery.md#identity) names.

## Browser Modules

The standalone inventory under `mokly-viewer/client/` is the client-rendered
shell: `shell.js` is the `@mokly/viewer/browser` entry bundled with React and
React DOM. `mokly-viewer/shell.css` and `mokly-viewer/fonts/**` complete the
shell's assets. The viewer package build records every browser output in the
browser module inventory v1. `build` copies exactly the files that inventory
lists, and Serve serves exactly those files; a package directory that differs
from its inventory fails the command.

`build` checks every decoded static import, re-export, and literal dynamic
import of each package-owned `.js` file under `mokly-viewer/` against the
inventory and the URL rules. A request that names no file of the inventory
fails the build. A computed dynamic expression is not evaluated and not
treated as a path. A script that does not parse as a module fails the build
and names the script.

The bundle detects a static build from the index, which has no `live` field.
In a static build the shell never requests the live descriptor, the event
stream, or a render; controls are read-only. It fetches the index and the
details under the [fetch rules](./mokly-shell-delivery.md#fetch-and-fences)
of the shell delivery contract and checks `mokly-viewer/deployment.json` with
each detail request for a page change and before comparison or removed-entry
requests. It uses the catalogue origin root for this request. A missing or
unreadable file does not change the shell state. Another id reloads the
standalone page. The shell applies the stored or system appearance before its
first render, so no pre-paint script exists.
Removed-content requests are limited to the generation that the index's
`comparisonUrl` names: the removed entry's detail, the preview metadata of a
removed page or document, and the snapshot documents beneath that
generation's permitted sides. There is no parallel vanilla Browse or preview runtime.

The inspector is `client/inspector.js`: React-free, at the 9,216-byte cap of
the [published inspector contract](./mokly-published-inspector.md). It runs
inside consumer documents under the [frame adapter](./mokly-frame-adapter.md)
and shares nothing with the shell bundle. No server module, watcher entry, or
live-host module enters the inventory. Module changes alter the deployment
identity as required below.

## Deployment Identity

A comparison generation identifies only its own files: the removed entries'
details, the snapshots, their resources, and the previews. Its directory name
is a 64-hex SHA-256 of its inventory. Use generation-relative file paths and
canonical JSON for metadata. Hash each generation file with its exact bytes and
sort the `[path, sha256]` pairs in UTF-16 order, then hash the canonical JSON
array. The removed details already carry content ids that do not depend on the
generation name. This gives one comparison the same bytes and the same name in
every build. The separate `deploymentId` identifies every installed file
except the ownership marker, the deployment file, and the publication metadata
that `publish` declares. Identity-participating files
include the stubs, the index, the details, the rendered documents, public
files, CSS, client modules, fonts, and every generation file. Publish declares
only `mokly-upload.json` as publication metadata.

The marker is excluded because it is derived from the finalized paths and
bytes. The deployment file is excluded because it stores the identity that
this hash computes. Publication metadata is excluded because its commit,
branch, and time fields describe delivery rather than browser content. The
deployment file and publication metadata remain owned files whose exact bytes
the marker records. Changing only publication metadata therefore changes the
marker without changing `deploymentId`. Unchanged identity-participating
content gives the same identity independently of insertion order and output
directory.

Finalize the identity after the complete non-marker inventory is fixed:

1. For the index, take the canonical JSON with its top-level `deploymentId`
   set to 64 zeros. For every other identity-participating file, take its exact
   bytes. Current detail ids already exclude the deployment id, and the
   deployment file is omitted from the inventory used for this hash.
2. Compute the SHA-256 of each result as 64 lowercase hex characters.
3. Sort the `[path, sha256]` pairs by `path` in UTF-16 code-unit order, the
   order the ownership marker uses.
4. The `deploymentId` is the SHA-256 of the canonical JSON encoding of that
   array of pairs.

Do not normalize lookalike fields inside consumer documents, scripts, or other
files; their bytes participate unchanged unless their exact path is declared
as publication metadata. Stamp the resulting identity into the index and write
the canonical `mokly-viewer/deployment.json` object with `schemaVersion: 1`. A
current detail carries its `detailId` and `revision`; a removed entry's detail
carries `detailId` and `snapshotId` instead. No generation file carries a
deployment id. Then compute the ownership entries from the exact finalized
bytes and add the marker through the same collision-checked inventory. No
identity-participating byte changes after identity finalization. The identity determines
the finalized browser content, while the marker is a pure function of all
final paths and bytes, including publication metadata. The comparison
generation keeps its separate URL and hash.

No page carries the identity. The stub embeds no descriptor; the shell reads
`deploymentId` and `revision` from the index and `deploymentId` from the
deployment file, and a build writes `revision: 0`. A detail whose `detailId`
differs from the installed index means another deployment replaced the files,
so the shell performs a full page load of the requested URL instead of mixing
deployments. Serve chooses one `deploymentId`
for the life of its process under the shell delivery contract, so a different
id always means another build or another server process. Within one
deployment, in-shell navigation and browser state preservation are unchanged.
