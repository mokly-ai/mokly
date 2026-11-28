# Guarded optional imports fail catalogue builds

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-22, from the optional-import side check of the
  overlapping reachable PnP roots measurement, on the branch
  `calummoore/fu-overlapping-reachable-pnp-roots-bas5`.
- **Location:** Lines at `586e74a3c`: `nativeLogOverride` in
  `packages/mokly/src/sidecar/native-resolution.ts:21`, the native compile
  options in `packages/mokly/src/sidecar/bundle.ts:239`, the full-path
  resolve in `packages/mokly/src/sidecar/plugins.ts:198`, and the test row
  "a handled require failure" in `tests/sidecar_native_fallback.test.ts:114`.
- **Reason:** B and C change the user's choice of 2026-10-27 to keep this
  failure, and they add a bundle rule that no protocol page states.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Guarded optional import:** a `require` of a package inside a `try`
    block whose `catch` accepts that the package is absent.
  - **Native compile:** the first esbuild compile of a bundle. esbuild
    resolves most imports itself, and the sidecar then classifies the result.
  - **Full path:** the compile in which the sidecar's resolve callback
    resolves each import with `build.resolve`. It runs after a failed native
    compile.
  - **`ignored-dynamic-import`:** the esbuild message for an unresolved
    import that esbuild leaves in its output, because the code seems to
    handle the failure.
- **Background:**
  - The sidecar bundles the catalogue code and its dependencies with esbuild
    for Node, with `platform: "node"` and `format: "cjs"`. It then runs the
    bundle to render each page.
  - Plain esbuild leaves an unresolved guarded `require` in its output, and
    it reports only `ignored-dynamic-import`. At run time Node resolves that
    call again. If the package stays absent, the call fails, and the `catch`
    of the dependency handles it.
  - At run time an installed copy of the package could resolve instead.
    That copy is outside the bundle and its reuse evidence. So B below
    forbids that lookup.
  - Mokly rejects such an import in each compile path:
    - `bundle.ts:239` gives the native compile
      `logOverride: { "ignored-dynamic-import": "error" }`, from
      `native-resolution.ts:21`. That message then fails the native compile.
    - The sidecar discards a failed native compile and compiles again on
      the full path.
    - On the full path, `plugins.ts:198` returns the errors of
      `resolveImport`. esbuild reports them as errors, also inside `try`.
  - The decision in force: on 2026-10-27 the user chose to keep this
    failure during the esbuild performance work of PR #226. That PR merged
    on 2026-10-28 as commit `3192b19b9060f0905d9f573784bce787b4f3707c`.
    - Its plan `plans/esbuild-resolve-fast-path.md` asked "Keep or relax the
      failure of a handled `require`". The chosen option kept today's
      failure through the log override.
    - The plan gave the reason: "It keeps the results identical. A change
      to the failure rules belongs to its own item." This item is that
      item.
    - The rejected option used esbuild's native rule for the imports that
      esbuild resolves itself. In that option, bare imports from catalogue
      files keep the failure. The plan said that it "adds one protocol
      requirement".
    - Commit `1b4aa23a3` still holds the archived plan:
      https://github.com/mokly-ai/mokly/blob/1b4aa23a3935da9a102a781851959391c8295d06/plans/esbuild-resolve-fast-path.md
  - The test row "a handled require failure" puts
    `let value = 1;\ntry { value = require("not-installed"); } catch {}\nmodule.exports = value;`
    in `node_modules/dep/index.cjs`. The bundle must fail with
    `bundle-failed` and
    `node_modules/dep/index.cjs:2:23: Could not resolve "not-installed"`,
    after two compiles.
  - No protocol page states a rule for a guarded import.
    `docs/protocol/mokly-configuration.md` lets alias keys and targets be
    bare package specifiers only. So an alias cannot mark a package absent.
  - At render time, `packages/mokly/src/sidecar/evaluate.ts` sends each
    `require` that the bundle does not hold to the consumer require. That
    require looks the name up from the configuration directory.
  - Each option keeps these requirements:
    - The bundle stays inside the source root and the selected dependency
      roots, as `docs/protocol/mokly-sidecar-modules.md` states.
    - A required import that does not resolve fails at build time, with
      its importer location. C relaxes this only for the listed specifiers.
    - The bundle targets Node, because Mokly renders on Node.
    - Bundles that build today keep identical results.
  - B and C drop the parity reason of the choice of 2026-10-27. That reason
    protected a performance change, and the plan gave a change of the
    failure rules its own item.
  - The reproduction of 2026-11-22:
    - The tool was the published `@mokly/mokly` 0.21.0 with
      `@mokly/native-linux-x64-gnu` 0.21.0 and esbuild 0.28.2. npm installed
      them in a folder outside the project. The tool ran on Node v24.22.1 on
      Linux x64.
    - The npm integrity of `@mokly/mokly` 0.21.0 is
      `sha512-E82fSfv39YKHMD/GP1xVB8bXGN2asvwpw77zLkuiO7LuGIb9ht4PwC1d872xdNVe89roKFlFRCir9epLg5A79g==`.
    - The project was `https://github.com/arcanis/eslint-plugin-arca` at
      `80b19434860ab183b687a147c165ae66adb6829f`. It uses Yarn 3.8.7 and
      the default PnP linker. The install ran from the clone root:

      ```sh
      YARN_ENABLE_GLOBAL_CACHE=false YARN_ENABLE_SCRIPTS=false \
        YARN_ENABLE_TELEMETRY=false YARN_GLOBAL_FOLDER="$PWD/.yarn/global" \
        node .yarn/releases/yarn-3.8.7.cjs install --immutable --mode=skip-build
      ```

    - The install gives ESLint 10.3.0, whose graph holds `debug` 4.3.2 and
      4.4.3. Both registry entries of `debug` list `supports-color` without
      a package, so that optional peer is absent.
    - Both `debug` versions guard the import in `src/node.js`. Lines 29 to
      32 open the `try`:

      ```js
      try {
        // Optional dependency (as in, doesn't need to be installed, NOT like optionalDependencies in package.json)
        // eslint-disable-next-line import/no-extraneous-dependencies
        const supportsColor = require('supports-color');
      ```

      Lines 114 to 116 close it:

      ```js
      } catch (error) {
        // Swallow - we only care if `supports-color` is available; it doesn't have to be.
      }
      ```

    - The catalogue was a new folder `mokly-optional-import-probe/` in the
      clone root, with three files. `mokly.config.json`:

      ```json
      {
        "repoRoot": "..",
        "roots": [{ "dir": "specs", "files": ["*.mockup.js"] }]
      }
      ```

      `eslint-library.mjs`:

      ```js
      import { Linter } from "eslint/universal";

      export const eslintVersion = Linter.version;
      ```

      `specs/optional.mockup.js`:

      ```js
      import { definePage } from "@mokly/mokly";

      import { eslintVersion } from "../eslint-library.mjs";

      export const optionalImportProbe = definePage({
        title: "Optional import probe",
        description: "Local proof using the real ESLint universal export.",
        relatedDocs: [],
        render: () =>
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Optional import probe</title></head><body><main>ESLint ${eslintVersion}</main></body></html>`,
      });
      ```

    - The configuration sets no renderer, alias, loader, condition, or
      other module resolution field.
    - The commands ran from the clone root. `{tool}` is the npm folder of
      the tool:

      ```sh
      NODE_OPTIONS="--require=$PWD/.pnp.cjs" node {tool}/node_modules/@mokly/mokly/bin/mokly.mjs \
        build --config "$PWD/mokly-optional-import-probe/mokly.config.json" \
        --out "$PWD/mokly-optional-import-probe/mokly-static" --no-changes --sidecars 1
      NODE_OPTIONS="--require=$PWD/.pnp.cjs" node {tool}/node_modules/@mokly/mokly/bin/mokly.mjs \
        serve --config "$PWD/mokly-optional-import-probe/mokly.config.json" \
        --port 8272 --no-watch --sidecars 1
      ```

    - Both commands exited with status 1. The build wrote no catalogue, and
      Serve stopped before it served a URL. Both printed this error, with
      its newlines escaped as `\u000a` in the raw log:

      ```text
      [mokly/build-invalid] .yarn/__virtual__/debug-virtual-e152771b72/0/cache/debug-npm-4.3.2-f0148b6afe-820ea160e2.zip/node_modules/debug/src/node.js:32:32: Could not resolve "supports-color"
      You can mark the path "supports-color" as external to exclude it from the bundle, which will remove this error and leave the unresolved path in the bundle. You can also surround this "require" call with a try/catch block to handle this failure at run-time instead of bundle-time.
      .yarn/__virtual__/debug-virtual-fdeeb92ace/0/cache/debug-npm-4.4.3-0105c6123a-4805abd570.zip/node_modules/debug/src/node.js:32:32: Could not resolve "supports-color"
      You can mark the path "supports-color" as external to exclude it from the bundle, which will remove this error and leave the unresolved path in the bundle. You can also surround this "require" call with a try/catch block to handle this failure at run-time instead of bundle-time.
      ```

  - The controls of 2026-11-22:
    - A second catalogue in the same folder imported only
      `eslint/package.json` and rendered its `version`. With the same tool,
      preload, and cache, its build exited with status 0, wrote 13 files,
      and showed `ESLint 10.3.0`.
    - Plain esbuild 0.28.2, with the same `NODE_OPTIONS`, bundled
      `native-entry.mjs`, which holds
      `export { eslintVersion } from "./eslint-library.mjs";`. It used the
      sidecar's main options: `bundle: true`, `platform: "node"`,
      `format: "cjs"`, `target: "node22"`, `jsx: "automatic"`,
      `jsxDev: true`, `keepNames: true`, `metafile: true`, and
      `conditions: []`.
    - That compile succeeded with 467 inputs and no warnings. The output
      kept two `require("supports-color")` calls.
    - The output was copied, unchanged, into `mokly-optional-import-probe/`.
      Both files have SHA-256
      `165d05067f711cfe9687d27fc5227d46c920fe586b8253e79ae91b7e95328cff`.
    - Under the project's `.pnp.cjs` preload, a `require` that Node's
      `createRequire` made at the copy's path failed to resolve
      `supports-color` with `MODULE_NOT_FOUND`. The same `require` then
      loaded the copy, which returned `{"eslintVersion":"10.3.0"}`.
    - So the bundle runs while `supports-color` is absent. This control
      does not show that each guarded `require` ran.
    - Run that check at a path inside the clone. A first run from a folder
      outside the clone could reach another installed copy of
      `supports-color` through Node's ancestor lookup.
    - The same esbuild compile with only
      `logOverride: { "ignored-dynamic-import": "error" }` failed twice with
      `Importing "supports-color" was allowed even though it could not be resolved because dynamic import failures appear to be handled here:`.
    - Plain esbuild with the same options also failed on ESLint's main
      export, `import { Linter } from "eslint"`, on `jiti` and
      `jiti/package.json`. Lines 508 and 509 of `lib/config/config-loader.js`
      hold those imports, outside a local `try`. That failure is not
      specific to Mokly.
    - The project's `package.json`, `yarn.lock`, `.yarnrc.yml`, `.pnp.cjs`,
      and `.pnp.loader.mjs` kept their SHA-256 values. Its tracked diff
      stayed empty.
  - The grades:
    - Severity Medium, because a workaround probably exists. If no
      workaround works in a layout, the work is blocked, and the grade is
      High.
    - Likelihood Rare, because catalogues of UI code seldom bundle Node
      libraries with guarded optional imports. The pattern is common in
      Node libraries, and Yarn PnP is a normal setup. If a normal UI
      catalogue meets this failure, change the grade to Common.
    - Nobody has proved a workaround. Under Yarn PnP, an optional peer comes
      from the packages that depend on `debug`, such as ESLint. So an
      install at the project root probably does not reach `debug`, and a
      fix can need Yarn `packageExtensions` and a lockfile change. Nobody
      ran this.
- **Problem:** A catalogue fails to build and to serve when a dependency
  holds a guarded optional import of a package that is not installed. The
  `catch` of the dependency never runs. The error tells the user to put the
  call in `try`, but the call is already there. esbuild alone bundles the
  same code, and the bundle runs.
- **Impact if no action:** Such a catalogue cannot use the library until
  its install provides the optional package or its imports avoid the
  guarded code. Other catalogues and their output stay correct.
- **Root question:** How should a catalogue use a library that
  intentionally supports an absent optional dependency?
- **Options:**
  - **A.** Keep the rejection. Record the rule in
    `docs/protocol/mokly-sidecar-modules.md`. Add a note under
    `docs/guides` with a workaround for each package manager, after a run
    proves each workaround. Optionally, correct the `try` hint of the
    error. The consumer then installs a package that the library does not
    need, and the class stays blocked. Effort: Small.
  - **C.** Add an opt-in `moduleResolution` list of package specifiers that
    the bundle treats as absent.
    - In each compile path, each listed import becomes a module that throws
      Node's not-found error when it runs. Unlisted imports keep today's
      failure.
    - The bundle never reads a listed package, so reuse does not have to
      prove that the package is absent. C also covers `jiti`.
    - Cost: a new field in the schema, the configuration contract, the
      core, and the shared types. The consumer must find and list each
      specifier. A listed import without a guard fails at render time, not
      at build time.
    - Effort: Medium.
  - **B.** Accept a missing import that esbuild treats as guarded, in the
    native, planned, and full compiles.
    - The omitted request throws Node's not-found error when it runs. The
      render never looks it up in the installation. Required imports keep
      today's failure.
    - Mokly reuses such a bundle only when it can prove that the package is
      still absent. Otherwise it compiles again.
    - Cost: esbuild's `OnResolveArgs` has no guard flag. It holds only
      `path`, `importer`, `namespace`, `resolveDir`, `kind`, `pluginData`,
      and `with`. So the planned and full compiles must learn of the guard
      from esbuild's messages.
    - B changes the existing test row and adds a protocol requirement. It
      does not cover imports that only a caller guards, such as `jiti`.
    - Effort: Large.
- **Left out:**
  - Removing only the native log override: a native result that is not
    exact plans a second compile. An unplanned import then goes to the full
    path, which still fails. So the result would depend on the compile path.
  - A list of external packages: an external request resolves at render
    time through the consumer require, outside the bundle and its reuse
    evidence. C differs, because a listed import never resolves.
  - A render-time failure for every unresolved dependency import: it hides
    required imports that are missing.
  - A separate fix for `jiti`: plain esbuild also rejects those imports. C
    covers them when the consumer lists them.
  - A change in `debug`: it already guards the import and declares
    `supports-color` as an optional peer.
- **Wider fix:** B. It removes the failure for every guarded import, with
  no consumer work. C is a direct fix that the consumer applies one
  specifier at a time.
- **Previous examples:**
  - On 2026-10-27 the plan of PR #226 kept this failure, so that the native
    and full-path results stay identical. It left a change of the failure
    rules to its own item.
  - On 2026-11-20 a measurement of PnP root overlap compiled real graphs
    with the sidecar source of commit `586e74a3c`. The same `supports-color`
    import of `debug` failed two of them:
    - Arca's test `tests/rules/curly.test.ts` at
      `80b19434860ab183b687a147c165ae66adb6829f`. It also failed on the
      unguarded `jiti` imports of ESLint.
    - Berry's `packages/plugin-npm/sources/npmProvenance.ts` at
      `a9edb7777f04ba16f51503ef6775325b353b67cc`.
  - Rollup configuration graphs failed on the optional `source-map-support`
    and `pnpapi` imports of TypeScript. Nobody checked whether those imports
    are guarded.
- **Recommendation:** B, as separate work, because it follows esbuild's own
  rule and needs no consumer work. C is the smaller choice, if the user
  wants an explicit rule or `jiti` coverage.
- **Action:** ask the user, because B reverses the user's choice of
  2026-10-27, which kept this failure for parity and left a change of the
  failure rules to its own item. B and C also add a bundle requirement that
  no protocol page states, and they have real trade-offs.
