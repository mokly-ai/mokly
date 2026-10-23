# Static Build Browser And Identity

This page supplements [Static Delivery](./mokly-export-delivery.md) with the
standalone browser inventory and the deployment identity algorithm that the
[shell delivery contract](./mokly-shell-delivery.md#identity) names.

## Browser Modules

The standalone inventory under `mokly-viewer/client/` is the client-rendered
shell: `shell.js`, the `@mokly/viewer/browser` entry bundled with React and
React DOM, the shell tree, the readers of the catalogue index and the entry
detail, the frame adapters, the message transport, geometry, the comparison
and removed-preview controllers, and the typed review and removed-preview
validators. `mokly-viewer/shell.css` and `mokly-viewer/fonts/**` complete the
shell's assets. The viewer package build records every browser output in the
browser module inventory v1. `build` copies exactly the files that inventory
lists, and Serve serves exactly those files; a package directory that differs
from its inventory fails the command.

`build` lexes every package-owned `.js` file under `mokly-viewer/` as a
module and checks every decoded static import, re-export, and literal dynamic
import against the inventory and the URL rules, including relative specifiers
that contain `+` or `:`. Quoted prose, comments, regular expressions, and
`import.meta` are not module requests. A computed dynamic expression is not
evaluated and not treated as a path. A lexer failure fails the build and names
the script.

The bundle detects a static build from the index, which has no `live` field.
In a static build the shell never requests the live descriptor, the event
stream, or a render; controls are read-only. It fetches the index and the
details under the [fetch rules](./mokly-shell-delivery.md#fetch-and-fences)
of the shell delivery contract and applies the stored or system appearance
before its first render, so no pre-paint script exists.
Removed-content requests are limited to the generation that the index's
`comparisonUrl` names: the removed entry's detail, the generation's
`review.json` for a removed screen's views, the preview metadata of a removed
page or document, and the snapshot documents beneath that generation's
permitted sides. There is no parallel vanilla Browse or preview runtime.

The inspector is `client/inspector.js`: React-free, at the 9,216-byte cap of
the [published inspector contract](./mokly-published-inspector.md). It runs
inside consumer documents under the [frame adapter](./mokly-frame-adapter.md)
and shares nothing with the shell bundle. No server module, watcher entry, or
live-host module enters the inventory. Module changes alter the deployment
identity as required below.

## Deployment Identity

A comparison generation identifies only its own files: `review.json`, the
removed entries' details, the snapshots, their resources, and the previews.
Its directory name is a 64-hex SHA-256 of its inventory. Use generation-relative
file paths and canonical JSON for metadata, with `review.json` in its compact
form. Set only each removed detail's top-level
`generation` to 64 zeros for hashing. Hash each file, sort the `[path, sha256]`
pairs in UTF-16 order, then hash the canonical JSON array. Stamp that result
into the removed details. This removes the identity's self-reference; one
comparison gives the same bytes and the same name in every build. The separate `deploymentId`
identifies every installed file except the ownership marker and the
publication metadata that `publish` declares. Identity-participating files
include the stubs, the index, the details, the rendered documents, public
files, CSS, client modules, fonts, and every generation file. Publish declares
only `mokly-upload.json` as publication metadata.

The marker is excluded because it is derived from the finalized paths and
bytes. Publication metadata is excluded because its commit, branch, and time
fields describe delivery rather than browser content. Both are owned files
that the marker hashes. Changing only publication metadata therefore changes
the marker without changing `deploymentId`. Unchanged identity-participating
content gives the same identity independently of insertion order and output
directory.

Finalize the identity after the complete non-marker inventory is fixed:

1. For the index and for every current entry's detail, take the canonical
   JSON of the document with its top-level `deploymentId` set to 64 zeros.
   For every other file, take its exact bytes.
2. Compute the SHA-256 of each result as 64 lowercase hex characters.
3. Sort the `[path, sha256]` pairs by `path` in UTF-16 code-unit order, the
   order the ownership marker uses.
4. The `deploymentId` is the SHA-256 of the canonical JSON encoding of that
   array of pairs.

Do not normalize lookalike fields inside consumer documents, scripts, or other
files; their bytes participate unchanged unless their exact path is declared
as publication metadata. Stamp the resulting identity into the index and into
every current entry's detail, changing no other byte. A removed entry's detail
carries `generation` and `snapshotId` instead, and no generation file carries
a deployment id. Then compute the ownership entries from the exact finalized
bytes and add the marker through the same collision-checked inventory. No
non-marker byte changes after identity finalization. The identity determines
the finalized browser content, while the marker is a pure function of all
final paths and bytes, including publication metadata. The comparison
generation keeps its separate URL and hash.

No page carries the identity. The stub embeds no descriptor; the shell reads
`deploymentId` and `revision` from the index, and a build writes `revision: 0`.
A detail whose `deploymentId` differs from the installed index means another
deployment replaced the files, so the shell performs a full page load of the
requested URL instead of mixing deployments. Serve chooses one `deploymentId`
for the life of its process under the shell delivery contract, so a different
id always means another build or another server process. Within one
deployment, in-shell navigation and browser state preservation are unchanged.
