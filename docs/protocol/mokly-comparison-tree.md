# Comparison Tree Model

The [comparison contract](./mokly-comparison.md) uses the following tree model.

A deeply nested rendered tree never aborts comparison. Canonical equality,
move fingerprints, and tree release work at any rendered depth. This rule
covers rendered trees.
Authored-input parsing, props, schemas, and CSS follow their own contracts.

Both sides of a view are the trees the core composed; a sidecar fragment is
parsed by a spec-compliant HTML parser, with its markers as comment nodes,
before it is grafted in. An element's owner is the innermost instance, slot,
or root region that contains it; slot content belongs to the region that
supplied it. The implied `html`, `head`, and `body` elements and every element
outside any region belong to the entry. On a component page the core attaches
the root region, id `r-0`, to the root component itself, with no marker. An
element inside an ignore region is
ignored. An ignore scope is resolved while the document is composed: a
disabled scope suppresses the ignore regions inside it, the innermost scope
wins, and no scope reaches comparison, as `ReviewIgnoreScope` defines. The core sends the enclosing scope state with each
component render, the sidecar resolves nesting from it, and the core applies no
outer scope to a fragment; slot content takes the state its placeholder reports
as its innermost scope.

Formatting clones that the adoption agency algorithm creates and elements that
the parser implies take their position in the tree; nothing refers to the
token that created them.

Usage and comparison ownership derive from the tree that the HTML5 parsing
algorithm builds from the composed bytes. Content moved by that parser
produces `html-foster-parented`, naming the component element and its parent.
An instance, slot, or ignore marker pair that no longer shares one parent
loses its region. Its nodes belong to the enclosing region; a split ignore
range compares as ordinary content. A slot record can remain without a range.
Remaining logical inputs and placements use that repaired ownership and their
corresponding identity keys. If a re-owned instance key collides, that instance
also loses its region; the repair remains a warning.

An HTML `plaintext` start tag consumes the rest of a document. Foreign-content
`plaintext` elements do not activate this mode. HTML integration points retain
their HTML parsing rules. Serialization omits the HTML `plaintext` end tag
and the end tags of ancestors entered before it. Formatting clones inside it
and nodes moved after it become part of the literal payload that the browser
receives. The repaired tree and its bytes stay stable on
further parse/serialize passes, including repair of annotated composed content.
Serialization writes text raw throughout plaintext mode, including formatting
clones and later nodes. Authored characters and entity spellings stay literal.
Plaintext on a component's own page retains its root range and ready Usage
through repair, even though plaintext consumes the trailing root boundary.
The parsed element must confirm the predicted HTML plaintext start. If it
does not, composition escapes all text so authored text stays inert. That
output keeps its end tags and region markers.
Inside HTML `noscript`, raw text escapes every case-insensitive `</noscript` to `&lt;/noscript`, preserving case but changing authored characters to prevent browser markup activation.
Serialization omits private markers and attributes inside plaintext mode. Other
HTML text modes follow the parser-context namespace, including component grafts
inside SVG and MathML. Foreign raw-text tag names keep text escaped.
`pre`, `textarea`, and `listing`
preserve the leading line feed that the HTML parser would otherwise remove.
