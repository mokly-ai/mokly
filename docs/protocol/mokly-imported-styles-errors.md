# Imported Stylesheet Diagnostics

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Every failure in this catalogue names the authored file, delivery root, or
module. A message never shows a virtual module, a sidecar path, or a working
directory. `{stylesheet}`, `{root}`, `{module}`, `{file}`, and `{directory}`
are repository-relative POSIX paths; `{line}` and `{column}` refer to the CSS
that the scoper or the bundler received, after PostCSS, never to a source-map
origin. Only `{detail}` may carry raw tool text.

## Configuration (`config-invalid`)

| Failure                                                    | Exact message                                                                                                                             |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Consumer `.css` or `.module.css` loader other than `empty` | `moduleResolution.loaders[{extension}] is package-owned; only "empty" is allowed to opt out of imported CSS delivery`                     |
| Consumer `css` loader on another extension                 | `moduleResolution.loaders[{extension}] cannot use "css"; rename the stylesheet to .css or use a JavaScript-safe loader`                   |
| `postcss` empty, non-string, or escaping path              | `postcss must name a config-relative module inside repoRoot: {config-path}; choose an existing .ts, .mts, .js, .mjs or .cjs file`         |
| `postcss` missing, non-file, or unsupported suffix         | `postcss module must be an existing regular .ts, .mts, .js, .mjs or .cjs file inside repoRoot: {config-path}`                             |
| `postcss` module load or default export failure            | `could not load postcss module {config-path}: {detail}; default-export an object with plugins`                                            |
| Unsupported module object key                              | `postcss configuration has unsupported key: {key}; only plugins and map are supported`                                                    |
| Invalid or missing `plugins`                               | `postcss plugins must be an array of plugin instances or an object mapping package names to option objects`                               |
| Invalid plugin array element                               | `postcss plugins[{index}] is not a PostCSS 8 plugin: {detail}; use a plugin instance, creator, function or object with a postcss factory` |
| Invalid plugin options                                     | `postcss plugins[{plugin}] must be a plain option object`                                                                                 |
| Plugin name resolution or factory failure                  | `could not load PostCSS plugin {plugin} from {config-path}: {detail}; install and configure it in the consumer repository`                |

`{index}` is zero-based. Module suffix and path checks run before the module
loads. Other configuration errors keep their messages under the
[configuration contract](./mokly-configuration.md).

## Build (`build-invalid`)

| Failure                                                 | Exact message                                                                                                                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root stylesheet route not portable                      | `cannot deliver imported CSS for {module}: the module path is not URL-safe; rename its file or directories (an entry path override does not change stylesheet routes)`                                                    |
| Two roots at one route                                  | `stylesheet route collision: {route}; give each root module a distinct repository path`                                                                                                                                   |
| Plain CSS transform failure                             | `could not transform CSS {stylesheet}: {detail}; fix the stylesheet and rebuild`                                                                                                                                          |
| CSS Modules parse or scoping failure                    | `could not transform CSS {stylesheet}:{line}:{column}: {reason}; fix the stylesheet and rebuild`                                                                                                                          |
| CSS Modules forward or missing composition              | `CSS Modules composition refers to a class not yet defined in {stylesheet}:{line}:{column}: {name}; define the composed class before this rule`                                                                           |
| CSS Modules composition on a non-local selector         | `CSS Modules composition requires a single local class in {stylesheet}:{line}:{column}; compose from a local class selector`                                                                                              |
| Authored CSS Modules ICSS rule                          | `CSS Modules authored ICSS rule is unsupported in {stylesheet}:{line}:{column}: {selector}; use local class exports or ordinary CSS`                                                                                      |
| Authored CSS Modules `@value`                           | `CSS Modules @value is unsupported in {stylesheet}:{line}:{column}; use a CSS custom property or JavaScript constant`                                                                                                     |
| CSS Modules transform changes more than local names     | `CSS Modules scoping would change more than local names in {stylesheet}:{line}:{column}; move this CSS to a plain stylesheet`                                                                                             |
| Empty CSS Modules selector wrapper                      | `CSS Modules {wrapper} has no selector in {stylesheet}:{line}:{column}; add a selector inside it or remove it` where `{wrapper}` is `:global()` or `:local()`                                                             |
| CSS Modules identity collision                          | `CSS Modules generated name collision: {name} in {first} and {second}; rename one local name or file`                                                                                                                     |
| Cross-file CSS Modules composition                      | `CSS Modules cross-file composes is unsupported in {stylesheet}: {specifier}; compose within this file or use a global name`                                                                                              |
| Non-JavaScript output from the bundle, including `file` | `consumer graph emitted an undelivered file: {file}; use a dataurl or binary loader for JavaScript assets instead of file`                                                                                                |
| JavaScript reaches CSS outside the repository           | `CSS import is outside repoRoot in {importer}: {specifier}; move the stylesheet inside repoRoot or remove the import`                                                                                                     |
| Late local CSS `@import`                                | `CSS @import must come before style rules in {stylesheet}: {specifier}; move the import before other rules`                                                                                                               |
| Quoted local string URL in `image-set()`                | `image-set() string URL is unsupported in {stylesheet}: {url}; wrap the URL in url() so Mokly can validate and deliver the asset`                                                                                         |
| Root-absolute CSS URL                                   | `root-absolute CSS url() is not portable in {stylesheet}: {url}; use a path relative to the stylesheet`                                                                                                                   |
| Relative CSS URL missing, non-file, or escaping         | `CSS asset is not a regular file inside repoRoot in {stylesheet}: {url}; move it inside the repository or fix the relative path`                                                                                          |
| Relative CSS URL with an unsupported extension          | `unsupported CSS asset extension in {stylesheet}: {url}; use .avif, .bmp, .gif, .ico, .jpeg, .jpg, .png, .svg, .webp, .eot, .otf, .ttf, .woff or .woff2`                                                                  |
| Non-portable asset route                                | `CSS asset route is not portable: {file}; rename every path segment to be URL-safe (letters, digits, dot, underscore, tilde or hyphen; @scope only after node_modules; no spaces or device names)`                        |
| Missing or invalid local CSS `@import`                  | `could not resolve CSS @import in {stylesheet}: {specifier}; use an existing stylesheet inside repoRoot`                                                                                                                  |
| `lightningcss` bundle failure                           | `could not bundle CSS {root}: {detail}; fix the stylesheet and rebuild`                                                                                                                                                   |
| PostCSS plugin throws                                   | `PostCSS plugin {plugin} failed for {stylesheet}: {detail}; fix the plugin configuration or stylesheet`                                                                                                                   |
| Plugin reports a nested renderer-owned import           | `PostCSS plugin {plugin} reached renderer-owned CSS in {stylesheet}: {excluded} via {intermediate}; import it only from the renderer, import it directly so Mokly can prune it, or use Tailwind @reference`               |
| Malformed plugin dependency message                     | `PostCSS plugin {plugin} reported an invalid dependency for {stylesheet}; report a file or directory path and optional glob`                                                                                              |
| Missing or non-file explicit plugin dependency          | `PostCSS plugin {plugin} reported a missing dependency for {stylesheet}: {file}; make it a regular file or correct the plugin`                                                                                            |
| Missing or non-directory plugin directory dependency    | `PostCSS plugin {plugin} reported a missing directory dependency for {stylesheet}: {directory}; create the directory or correct the plugin`                                                                               |
| Document references a plugin-reported dependency        | `protected target {reference}: PostCSS plugin {plugin} reported it as a dependency of {stylesheet}; exclude it from the plugin's sources (Tailwind: @source not "{relative-file}" or source(none) with explicit @source)` |
| Document references an imported stylesheet or asset     | `protected target {reference}: imported by {stylesheet}; reference the delivered route under static/mokly-generated/ or keep a separate public copy`                                                                      |

The two protected-target rows are `<reason>` texts of the document-link
diagnostic below; the policy denial names the lister so the author can act
on it. `{relative-file}` is the path from the offending stylesheet's
directory to the referenced file, prefixed with `./` when neither `.` nor
`..` starts it, with POSIX separators. A missing directory is reported after
a missing explicit file, and a directory error names the reported logical
path. Reports outside the repository or physically under `node_modules` are
ignored, never errors.

A link or a `url()` that names a bundled route absent from the current
generation never reads a stale file. It fails with the document-link
diagnostic of the [referenced closure](./mokly-public-closure.md):
`document links and resources are invalid:\n- {source-route}: missing target {reference}`.

A sidecar failure while `processCss` runs, that is a crash, a timeout, or a
protocol error, uses the [fail-closed codes](./mokly-sidecar.md#fail-closed-rules)
of the sidecar contract. The [build warning record](./mokly-build-warnings.md)
carries no stylesheet warning; every stylesheet problem is an error.
