# Imported Stylesheet Diagnostics

## Delivery Status

The diagnostics for [imported stylesheet delivery](./mokly-imported-styles.md).
Each message below is the complete `MoklyError` message body; the CLI adds
its normal `[mokly/<code>]` prefix. Placeholders are unquoted POSIX paths
relative to `repoRoot` unless named `config-path` (config-relative), `url`
(the authored URL), `glob` (authored pattern) or `detail` (underlying error).
`stylesheet` means the repo-relative physical CSS file that ran PostCSS;
`plugin` is its PostCSS plugin name. List multiple failures in stable
repo-relative path order and report the first according to the precedence
in the parent contract.
For CSS Modules errors, `{line}:{column}` identifies the effective stylesheet
text after renderer pruning and consumer PostCSS, not a synthetic bundle path
or a position from an input source map; the message never includes a PostCSS
plugin name or absolute filename.

## Configuration (`config-invalid`)

| Failure                                                    | Exact message                                                                                                                             |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Reserved root file-pattern static prefix                   | `roots[{index}].files must not select mokly-generated/: {glob}; narrow the file glob to authored files`                                   |
| Reserved root directory                                    | `roots[{index}].dir must not select mokly-generated/: {config-path}; choose a directory of authored entry modules`                        |
| Reserved `stylesheets` path                                | `stylesheets[{index}].{field} must not reference mokly-generated/: {path}; link imported CSS through the renderer instead`                |
| Reserved Review directory                                  | `review.outDir must not be at or inside mokly-generated/; choose a separate artifact directory`                                           |
| Consumer `.css` or `.module.css` loader other than `empty` | `moduleResolution.loaders[{extension}] is package-owned; only "empty" is allowed to opt out of imported CSS delivery`                     |
| Consumer `css` loader on another extension                 | `moduleResolution.loaders[{extension}] cannot use "css"; rename the stylesheet to .css or use a JavaScript-safe loader`                   |
| `postcss` empty/non-string/escaping path                   | `postcss must name a config-relative module inside repoRoot: {config-path}; choose an existing .ts, .mts, .js, .mjs or .cjs file`         |
| `postcss` missing, non-file or unsupported suffix          | `postcss module must be an existing regular .ts, .mts, .js, .mjs or .cjs file inside repoRoot: {config-path}`                             |
| `postcss` module load/default export failure               | `could not load postcss module {config-path}: {detail}; default-export an object with plugins`                                            |
| Unsupported module object key                              | `postcss configuration has unsupported key: {key}; only plugins and map are supported`                                                    |
| Invalid/missing `plugins`                                  | `postcss plugins must be an array of plugin instances or an object mapping package names to option objects`                               |
| Invalid plugin array element                               | `postcss plugins[{index}] is not a PostCSS 8 plugin: {detail}; use a plugin instance, creator, function or object with a postcss factory` |
| Invalid plugin options                                     | `postcss plugins[{plugin}] must be a plain option object`                                                                                 |
| Plugin name resolution/factory failure                     | `could not load PostCSS plugin {plugin} from {config-path}: {detail}; install and configure it in the consumer repository`                |

The `stylesheets` `{field}` is `stylesheets`, `lightStylesheets` or
`darkStylesheets`; `{index}` is zero-based. Removed `publicExclude` is rejected at configuration load. Other errors retain
their existing messages. Module suffix/path aliases are checked before load.

## Build (`build-invalid`)

| Failure                                                                        | Exact message                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventoried authoring file below reserved directory                            | `authoring input is inside mokly-generated/: {file}; move authored sources outside Mokly's output directory`                                                                                                                                       |
| Generated stylesheet path not portable                                         | `cannot deliver imported CSS for {module}: the module path is not URL-safe; rename its file or directories (an entry path override does not change stylesheet routes)`                                                                             |
| Root path collision                                                            | `generated route collision: {route}; give each entry root a distinct repository path`                                                                                                                                                              |
| Shared asset route has different bytes                                         | `CSS asset bytes disagree at {route}; keep shared asset inputs stable during the build`                                                                                                                                                            |
| Symlink or non-regular entry in reserved directory                             | `mokly-generated/ contains a symlink or non-regular entry: {file}; delete it before building or checking`                                                                                                                                          |
| Invalid reserved output shape                                                  | `generated route is unsafe: {route}`                                                                                                                                                                                                               |
| Plain CSS transform failure                                                    | `could not transform CSS {stylesheet}: {detail}; fix the stylesheet and rebuild`                                                                                                                                                                   |
| CSS Modules parse or scoping failure                                           | `could not transform CSS {stylesheet}:{line}:{column}: {reason}; fix the stylesheet and rebuild`                                                                                                                                                   |
| Unexpected CSS Modules plugin failure                                          | `could not transform CSS {stylesheet}:1:1: unsupported CSS Modules syntax; fix the stylesheet and rebuild`                                                                                                                                         |
| CSS Modules forward or missing composition                                     | `CSS Modules composition refers to a class not yet defined in {stylesheet}:{line}:{column}: {name}; define the composed class before this rule`                                                                                                    |
| CSS Modules composition on a non-local selector                                | `CSS Modules composition requires a single local class in {stylesheet}:{line}:{column}; compose from a local class selector`                                                                                                                       |
| Authored CSS Modules ICSS rule                                                 | `CSS Modules authored ICSS rule is unsupported in {stylesheet}:{line}:{column}: {selector}; use local class exports or ordinary CSS`                                                                                                               |
| Authored CSS Modules @value                                                    | `CSS Modules @value is unsupported in {stylesheet}:{line}:{column}; use a CSS custom property or JavaScript constant`                                                                                                                              |
| Malformed CSS Modules `@scope` prelude                                         | `CSS Modules @scope prelude is invalid in {stylesheet}:{line}:{column}; use an optional (start) and/or to (limit)`                                                                                                                                 |
| CSS Modules transform changes more than local names                            | `CSS Modules scoping would change more than local names in {stylesheet}:{line}:{column}; move this CSS to a plain stylesheet`                                                                                                                      |
| Empty CSS Modules selector wrapper                                             | `CSS Modules {wrapper} has no selector in {stylesheet}:{line}:{column}; add a selector inside it or remove it` where `{wrapper}` is `:global()` or `:local()`                                                                                      |
| Unsafe CSS Modules selector escape                                             | `CSS Modules cannot safely scope an escape in {stylesheet}:{line}:{column}; write the escape with at most five hex digits followed by exactly one space, then any spacing or comment`                                                              |
| Plugin reports a nested renderer-owned import                                  | `PostCSS plugin {plugin} reached renderer-owned CSS in {stylesheet}: {excluded} via {intermediate}; import it only from the renderer, import it directly so Mokly can prune it, or use Tailwind @reference`                                        |
| Other esbuild CSS bundle failure                                               | `could not bundle CSS {root}: {detail}; fix the stylesheet and rebuild`                                                                                                                                                                            |
| CSS Modules identity collision                                                 | `CSS Modules generated name collision: {name} in {first} and {second}; rename one local name or file`                                                                                                                                              |
| Graph/stylesheet CSS Modules map differs                                       | `CSS Modules exports differ after renderer pruning in {stylesheet}; avoid inlining shared imports in modules or use Tailwind @reference`                                                                                                           |
| Cross-file CSS Modules composition                                             | `CSS Modules cross-file composes is unsupported in {stylesheet}: {specifier}; compose within this file or use a global name`                                                                                                                       |
| Non-JS output from graph (including JS `file` loader)                          | `consumer graph emitted an undelivered file: {file}; use a dataurl or binary loader for JavaScript assets instead of file`                                                                                                                         |
| JavaScript reaches CSS outside `repoRoot` by import, require or dynamic import | `CSS import is outside repoRoot in {importer}: {specifier}; move the stylesheet inside repoRoot or remove the import`                                                                                                                              |
| Late local CSS `@import`                                                       | `CSS @import must come before style rules in {stylesheet}: {specifier}; move the import before other rules`                                                                                                                                        |
| Quoted local string URL in `image-set()`                                       | `image-set() string URL is unsupported in {stylesheet}: {url}; wrap the URL in url() so Mokly can validate and deliver the asset`                                                                                                                  |
| Root-absolute CSS URL                                                          | `root-absolute CSS url() is not portable in {stylesheet}: {url}; use a path relative to the stylesheet`                                                                                                                                            |
| Relative CSS URL missing, non-file or escaping `repoRoot`                      | `CSS asset is not a regular file inside repoRoot in {stylesheet}: {url}; move it inside the repository or fix the relative path`                                                                                                                   |
| Relative CSS URL unsupported extension                                         | `unsupported CSS asset extension in {stylesheet}: {url}; use .avif, .bmp, .gif, .ico, .jpeg, .jpg, .png, .svg, .webp, .eot, .otf, .ttf, .woff or .woff2`                                                                                           |
| Non-portable asset route                                                       | `CSS asset route is not portable: {file}; rename every path segment to be URL-safe (letters, digits, dot, underscore, tilde or hyphen; @scope only after node_modules; no spaces or device names)`                                                 |
| Missing/invalid local CSS `@import`                                            | `could not resolve CSS @import in {stylesheet}: {specifier}; use an existing stylesheet inside repoRoot`                                                                                                                                           |
| PostCSS plugin throws                                                          | `PostCSS plugin {plugin} failed for {stylesheet}: {detail}; fix the plugin configuration or stylesheet`                                                                                                                                            |
| Isolated PostCSS worker unexpectedly stops                                     | `PostCSS worker for {module} stopped unexpectedly ({reason}); check the plugin and rebuild`                                                                                                                                                        |
| Malformed plugin dependency message                                            | `PostCSS plugin {plugin} reported an invalid dependency for {stylesheet}; report a file or directory path and optional glob`                                                                                                                       |
| Missing/non-file explicit plugin dependency                                    | `PostCSS plugin {plugin} reported a missing dependency for {stylesheet}: {file}; make it a regular file or correct the plugin`                                                                                                                     |
| Missing/non-directory plugin directory dependency                              | `PostCSS plugin {plugin} reported a missing directory dependency for {stylesheet}: {directory}; create the directory or correct the plugin`                                                                                                        |
| Explicit Mokly output dependency                                               | `PostCSS plugin {plugin} scanned Mokly-generated output in {stylesheet}: {file}; exclude mockupsDir from the plugin's sources (Tailwind: @source not "{relative-mockups-dir}")`                                                                    |
| Explicit public file below `mockupsDir`                                        | `PostCSS plugin {plugin} scanned a public mockups file in {stylesheet}: {file}; exclude mockupsDir from the plugin's sources (Tailwind: @source not "{relative-mockups-dir}")`                                                                     |
| Directory glob reaches a public mockups file                                   | `PostCSS plugin {plugin} directory dependency scans a public mockups file in {stylesheet}: {file}; exclude mockupsDir by excluding the matching scan root (Tailwind: @source not "{relative-reported-dir}" or source(none) with explicit @source)` |

Every CSS-pass `{stylesheet}` or `{root}` names the authored file or delivery
root, never `mokly:styles:N` or its esbuild namespace. Synthetic absolute
imports are displayed relative to the delivery root; only `{detail}` may
contain raw esbuild text after virtual names have been replaced.

An imported CSS asset that is a public file inside `mockupsDir` and is not
already a graph source fails with `build-invalid` and the exact message:
`CSS asset is already public in {stylesheet}: {file}; move the imported asset outside mockupsDir or keep it as a separately linked public file`.

A nested `@import` of a public stylesheet inside `mockupsDir` that is not
already an inventoried graph source fails with `build-invalid` and the exact
message: `CSS @import is already public in {stylesheet}: {file}; move the imported stylesheet outside mockupsDir or link it as public CSS`.
Both guards check the reported logical path and its physical alias, so a
symlinked `mockupsDir` does not silently privatize public files.

`{relative-mockups-dir}` is the path from the offending stylesheet's
directory to `mockupsDir`, prefixed with `./` if neither `.` nor `..` starts
it, with POSIX separators. `{relative-reported-dir}` is the same relative
form for the matching `dir-dependency.dir`; it can be an ancestor of
`mockupsDir`. Directory errors name the first matching existing
file, sorted by path. The explicit-generated check precedes the
public-file check. Directory reports skip the generated tree. Ignored outside-root and
`node_modules` paths are not errors. Existing `manifest-invalid` stale-source
guidance remains `source inventory is stale; run mokly build before serving or publishing`.
Generated paths use the [unified output admission rule](./mokly-unified-output.md).
The reserved-tree filesystem check runs only at a writer boundary or tracked
Check, before replacement; in-memory consumers never inspect stale disk output.
An HTML or CSS reference to a reserved route absent from the current pending
generation never reads a stale disk file. It uses the existing `build-invalid`
document-link diagnostic:
`document links and resources are invalid:\n- {source-route}: missing target {reference}`.
The pending manifest is never a public target; references to it retain the
existing `protected target {reference}: targets internal catalogue metadata`
violation, including on the first Build before a manifest exists on disk.
The root itself must be a directory when it exists; every descendant must be
a directory or regular file. The invalid-entry message names the first entry
in sorted repository-relative path order, including the root if invalid.
The authoring-input message names the logical path when that identity is inside
the reserved tree, otherwise the physical path when a symlink points inside it.
