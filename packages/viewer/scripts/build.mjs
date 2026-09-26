import fs from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

import { buildBrowserModules, writeBrowserManifest } from "./browser.mjs";
import { bundleInspector } from "./inspector-bundle.mjs";
import { embeddedStyles } from "./styles.mjs";

const root = path.resolve(import.meta.dirname, "..");
const target = path.join(root, "dist");
await fs.cp(path.join(root, "src/shell/assets"), path.join(target, "assets"), {
  recursive: true,
});
await buildBrowserModules(
  path.join(root, "src/client"),
  path.join(target, "browser"),
  {
    additionalEntries: {
      recovery: path.join(root, "src/standalone/recovery.ts"),
    },
  },
);
await build({
  bundle: true,
  define: { "process.env.NODE_ENV": '"production"' },
  entryPoints: [path.join(root, "src/browser.tsx")],
  format: "esm",
  logLevel: "silent",
  minify: true,
  outfile: path.join(target, "browser/react-shell.js"),
  platform: "browser",
  plugins: [staticHydrationCompatibility()],
  target: "es2023",
});
await build({
  bundle: true,
  entryPoints: {
    "appearance-startup": path.join(
      root,
      "src/standalone/appearance_startup.ts",
    ),
    "navigation-resize": path.join(root, "src/standalone/navigation_resize.ts"),
  },
  format: "iife",
  logLevel: "silent",
  outdir: path.join(target, "browser"),
  platform: "browser",
  target: "es2023",
});
await bundleInspector(
  path.join(root, "src/inspector/index.ts"),
  path.join(target, "browser/inspector.js"),
);
await writeBrowserManifest(path.join(target, "browser"));
const { SHELL_CSS } = await import("../dist/shell/css.js");
const { VIEWER_CSS } = await import("../dist/viewer/styles.js");
await fs.writeFile(
  path.join(target, "styles.css"),
  embeddedStyles(SHELL_CSS, VIEWER_CSS),
);

/** Keep finalized static artifacts byte-stable while live hosts use the strict module. */
function staticHydrationCompatibility() {
  const browser = path.join(root, "src/browser.tsx");
  const scoped = path.join(root, "src/standalone/scoped_bootstrap.ts");
  return {
    name: "static-hydration-compatibility",
    setup(builder) {
      builder.onLoad(
        { filter: /(?:browser|scoped_bootstrap)\.tsx?$/ },
        async (args) => {
          if (args.path !== browser && args.path !== scoped) return;
          const source = await fs.readFile(args.path, "utf8");
          return {
            contents:
              args.path === browser
                ? transitionalBrowserSource(source)
                : transitionalScopedSource(source),
            loader: args.path.endsWith("x") ? "tsx" : "ts",
          };
        },
      );
    },
  };
}

function transitionalBrowserSource(source) {
  source = replaceRequired(
    source,
    "interface BrowserHydrationState {\n  hydratedDocuments: WeakSet<Document>;\n  pendingDocuments: WeakSet<Document>;\n}\n\nconst hydrationGlobal = globalThis as typeof globalThis & {\n  __moklyViewerHydrationStateV1?: BrowserHydrationState;\n};\nconst hydrationState = (hydrationGlobal.__moklyViewerHydrationStateV1 ??= {\n  hydratedDocuments: new WeakSet<Document>(),\n  pendingDocuments: new WeakSet<Document>(),\n});\nconst { hydratedDocuments, pendingDocuments } = hydrationState;",
    "const hydratedDocuments = new WeakSet<Document>();\nconst pendingDocuments = new WeakSet<Document>();",
  );
  source = replaceRequired(
    source,
    "import {\n  readLiveShellBootstrapState,",
    "import {\n  LIVE_SHELL_BOOTSTRAP_MODE,\n  readLiveShellBootstrapState,",
  );
  return replaceRequired(
    source,
    "  const bootstrapState = readLiveShellBootstrapState(JSON.parse(bootstrapJson));",
    "  const bootstrapState = readLiveShellBootstrapState(\n    JSON.parse(bootstrapJson),\n    LIVE_SHELL_BOOTSTRAP_MODE,\n  );",
  );
}

function transitionalScopedSource(source) {
  source = replaceRequired(
    source,
    'import { readShellCatalogue } from "../catalogue/reader.js";',
    'import { resolveCatalogueRoute } from "../catalogue/entry_selection.js";\nimport { readShellCatalogue } from "../catalogue/reader.js";',
  );
  source = replaceRequired(
    source,
    "import {\n  catalogueUsageViews,",
    "import {\n  catalogueHasOmittedUsage,\n  catalogueUsageViews,",
  );
  source = replaceRequired(
    source,
    "/** A validated live bootstrap whose usage is exactly scoped to its view. */\nexport type LiveShellBootstrap = ScopedShellBootstrap;",
    '/** A validated live bootstrap accepted during the complete-to-scoped rollout. */\nexport type LiveShellBootstrap = ScopedShellBootstrap;\n/** Whether live pages may still carry complete usage during staged rollout. */\nexport type LiveShellBootstrapMode = "scoped" | "transitional";\n/** Current staged live-reader policy; Milestone 6 switches this with emission. */\nexport const LIVE_SHELL_BOOTSTRAP_MODE: LiveShellBootstrapMode = "transitional";',
  );
  source = replaceRequired(
    source,
    "  return readLiveShellBootstrap(value);",
    '  return readLiveShellBootstrap(value, "scoped");',
  );
  source = replaceRequired(
    source,
    "/** Validate one exactly route-scoped live page. */\nexport function readLiveShellBootstrap(value: unknown): LiveShellBootstrap {",
    "/** Read one live page under an explicit rollout mode. */\nexport function readLiveShellBootstrap(\n  value: unknown,\n  mode: LiveShellBootstrapMode,\n): LiveShellBootstrap {",
  );
  source = replaceRequired(
    source,
    "  return readLiveEnvelope(envelope);",
    "  return readLiveEnvelope(envelope, mode);",
  );
  source = replaceRequired(
    source,
    "/** Validate a scoped live page or the unchanged static external reference. */\nexport function readLiveShellBootstrapState(\n  value: unknown,\n): LiveShellBootstrapState {",
    "/** Read live state transitionally while preserving static external validation. */\nexport function readLiveShellBootstrapState(\n  value: unknown,\n  mode: LiveShellBootstrapMode,\n): LiveShellBootstrapState {",
  );
  source = replaceRequired(
    source,
    "  return readLiveEnvelope(envelope);\n}\n\nfunction readLiveEnvelope",
    "  return readLiveEnvelope(envelope, mode);\n}\n\nfunction readLiveEnvelope",
  );
  source = replaceRequired(
    source,
    "function readLiveEnvelope(\n  envelope: ShellBootstrapEnvelope<unknown>,\n): LiveShellBootstrap {\n  const catalogue = readShellCatalogue(envelope.catalogue);\n  enforceExactScope(catalogue, envelope.view);",
    'function readLiveEnvelope(\n  envelope: ShellBootstrapEnvelope<unknown>,\n  mode: LiveShellBootstrapMode,\n): LiveShellBootstrap {\n  const catalogue = readShellCatalogue(envelope.catalogue);\n  if (mode === "transitional" && !catalogueHasOmittedUsage(catalogue)) {\n    if (\n      envelope.view.kind === "target" &&\n      !resolveCatalogueRoute(catalogue, envelope.view.route)\n    )\n      invalidData("$bootstrap", "invalid shell hydration target");\n    return { ...envelope, catalogue };\n  }\n  enforceExactScope(catalogue, envelope.view);',
  );
  return source;
}

function replaceRequired(source, before, after) {
  if (!source.includes(before))
    throw new Error("Static hydration compatibility source drifted.");
  return source.replace(before, after);
}
