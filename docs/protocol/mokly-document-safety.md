# Document Rendering Safety

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This continues [Markdown Documents](./mokly-documents.md#rendering).

## Structural Validation

After logical-link rewriting, validate the composed document tree
independently of the Markdown renderer. Validate outer wrappers too, so an
injected HTML/body start tag cannot hide an event attribute by merging it
onto an existing wrapper. `build`, Serve, and the base side of a comparison
use this same boundary before a document is accepted.

Only HTML-namespace elements in this table are allowed in the rendered body:

| Elements                                                                                                 | Attributes and values                                                          |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `p`, `blockquote`, `ul`, `li`, `hr`, `pre`, `em`, `strong`, `del`, `table`, `thead`, `tbody`, `tr`, `br` | None                                                                           |
| `h1` through `h6`                                                                                        | Optional nonempty `id`: Unicode letters, numbers, combining marks, `_` and `-` |
| `code`                                                                                                   | Optional `class` beginning `language-` with a nonempty language                |
| `ol`                                                                                                     | Optional `start`: one to nine decimal digits                                   |
| `a`                                                                                                      | `href`, optional `title`, and a validated package-written `data-mokly-link`    |
| `img`                                                                                                    | `src`, `alt`, optional `title`                                                 |
| `th`, `td`                                                                                               | Optional `align`: `left`, `center` or `right`                                  |
| `input`                                                                                                  | Required `type="checkbox"` and empty `disabled`; optional empty `checked`      |

The template additionally owns its direct-body `main` wrapper with no attributes.
Every other body element or attribute is rejected, including `script`, `style`,
`iframe`, `object`, `embed`, `svg`, `math`, `form`, any `on*` attribute and any
body `style` attribute. Comments are inert; a served or built document carries
no comment markers under the [comparison contract](./mokly-comparison.md).

`href` and `src` permit only `http:`, `https:` and `mailto:` schemes, or portable
relative/fragment URLs. Reject other schemes, controls, backslashes, leading or
trailing whitespace, root-absolute URLs and protocol-relative URLs. Shared link
and resource validation still checks targets, fragments and confinement.

The outer `html` permits only `lang="en"` and the template's exact
`style="color-scheme: light"` or `style="color-scheme: dark"`. `head` and `body`
have no attributes. The head permits only the template's UTF-8 charset meta,
viewport meta, text title and one inline stylesheet; title/style have no
attributes. Meta attribute values are restricted to the template's charset and
viewport declarations. This exception never permits a stylesheet in the body.

Failure is `build-invalid` with
`<location>: unsafe rendered document: <reason>`. Reasons are:

- `element <tag> is not allowed`;
- `attribute <name> on <tag> is not allowed`;
- `<attribute> on <tag> is not an allowed URL`;
- `<input> must be disabled` or `<input> must have checkbox type`;
- `the template must contain one owned stylesheet`.

Reject unsafe output rather than silently removing markup. A rejected document
fails `build`; Serve keeps the last good generation, as for every other render
failure.

## Script Policy

The document template contains no script. It does not add a
`script-src 'none'` CSP meta: Serve and the static output add Mokly's bounded
inspector script for authenticated link and frame behavior. That CSP would block
the package's instrumentation too. Raw Markdown is literal text, and the
independent final allowlist prevents a renderer error from introducing executable
elements or attributes. Historical frames keep their existing script-disabled
sandbox under the [removed-preview contract](./mokly-removed-preview-frames.md).

## Verification

Exercise raw-mode text after `code`, `pre`, `kbd` and `script` open tags, including
case and attribute variations. Preserve later prose, paragraphs, headings, lists,
blockquotes, tables, links and emphasis as text. Inject unsafe final markup after
the renderer to prove the independent boundary rejects it. Cover element,
attribute, checkbox and URL rules, plus events merged onto the outer wrapper.
Keep valid CommonMark/GFM output, both schemes, Serve links and the static
output working.
