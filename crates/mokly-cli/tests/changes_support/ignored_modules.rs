//! Head render inputs for the ignored-module warning journey.

use std::fs;
use std::path::PathBuf;

use tempfile::TempDir;

use super::changes_support::{base, write};
use super::links::link_directory;

const POSTCSS: &str = r#"
import { createRequire } from "node:module";
import { value } from "./bundled.mjs";
const plugin = "./plugin.cjs";
const relative = require(plugin);
const load = name => require(name);
const tracked = load("workspace-theme/tracked");
const untracked = load("workspace-theme/untracked");
const ignoredSource = load("workspace-theme/ignored-source");
const disabled = load("disabled-plugin");
const root = load("workspace-theme/root");
const computed = await import([".", "computed.mjs"].join("/"));
const json = await import([".", "native.json"].join("/"), { with: { type: "json" } });
const native = createRequire(import.meta.url)("./native.cjs");
export default {
  plugins: {
    "record-plugin": {
      value: [value, relative, tracked, untracked, ignoredSource, disabled, root,
        computed.default, json.default, native].join("-"),
    },
  },
};
"#;

const PLUGIN: &str = r#"
import path from "node:path";
import tailwind from "@tailwindcss/postcss";
export default ({ value }) => ({
  plugins: [
    {
      postcssPlugin: "fixture",
      Once(root, { result }) {
        result.messages.push({ type: "dir-dependency", plugin: "fixture",
          dir: path.resolve(import.meta.dirname, "../../../generated/scan"), glob: "*.css" });
        root.walkDecls("--fixture", decl => { decl.value = value; });
      },
    },
    ...tailwind({ optimize: false }).plugins.map(plugin => ({
      ...plugin,
      Once(root, helpers) {
        if (root.source.input.file.endsWith("tailwind.css")) return plugin.Once(root, helpers);
      },
    })),
  ],
});
"#;

pub(super) fn warning_fixture() -> TempDir {
    let root = base(&[
        (
            ".gitignore",
            "node_modules/\nmokly-static/\ngenerated/\npackages/*/dist/\npackages/*/esm/\npackages/theme/root.cjs\npackages/theme/source/ignored-source.js\n",
        ),
        (
            "package.json",
            r#"{"name":"catalogue","private":true,"workspaces":["packages/*"]}"#,
        ),
        (
            "dependencies/package.json",
            r#"{"name":"fixture-dependencies"}"#,
        ),
        (
            "packages/theme/package.json",
            r#"{"name":"workspace-theme","exports":{"./tracked":"./esm/tracked.cjs","./untracked":"./esm/untracked.cjs","./ignored-source":"./esm/ignored-source.cjs","./root":"./root.cjs","./js":"./esm/package.mjs","./css":"./esm/package.css"}}"#,
        ),
        (
            "packages/record/package.json",
            r#"{"name":"record-plugin","exports":"./esm/index.mjs"}"#,
        ),
        (
            "packages/disabled/package.json",
            r#"{"name":"disabled-plugin","exports":"./dist/index.cjs"}"#,
        ),
        (
            "packages/plugin-theme/package.json",
            r#"{"name":"plugin-theme","exports":{"./skin.css":"./dist/skin.css"}}"#,
        ),
        ("packages/theme/source/tracked.js", "module.exports='src';"),
        ("packages/disabled/src/index.js", "module.exports='src';"),
        (
            "packages/plugin-theme/src/skin.css",
            ".source { color: red }",
        ),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<p>Home</p>",
        ),
    ]);
    let path = root.path();
    let modules = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../node_modules");
    link_directory(&modules, &path.join("dependencies/node_modules"));
    fs::create_dir(path.join("node_modules")).unwrap();
    for name in ["@mokly", "@tailwindcss", "react", "react-dom"] {
        link_directory(&modules.join(name), &path.join("node_modules").join(name));
    }
    for (name, folder) in [
        ("workspace-theme", "theme"),
        ("record-plugin", "record"),
        ("disabled-plugin", "disabled"),
        ("plugin-theme", "plugin-theme"),
    ] {
        link_directory(
            &path.join("packages").join(folder),
            &path.join("node_modules").join(name),
        );
    }
    for (file, bytes) in [
        (
            "mokly.config.json",
            r#"{"review":{"base":"fixture-base"},"postcss":"generated/postcss.mjs","moduleResolution":{"packageRoots":["dependencies"],"sourcePackages":{"workspace-theme":{"esm":"source"},"disabled-plugin":false}},"stylesheets":[{"match":"**","stylesheets":["style.css","tailwind.css"]}]}"#,
        ),
        ("generated/postcss.mjs", POSTCSS),
        ("generated/plugin.cjs", "module.exports='loaded';"),
        ("generated/native.cjs", "module.exports='native';"),
        ("generated/native.json", "\"native-json\""),
        ("generated/bundled.mjs", "export const value = 'node';"),
        ("generated/computed.mjs", "export default 'computed';"),
        ("generated/scan/only-scanned.css", ".scanned { color: red }"),
        ("packages/record/esm/index.mjs", PLUGIN),
        ("packages/disabled/dist/index.cjs", "module.exports='off';"),
        ("packages/theme/root.cjs", "module.exports='root';"),
        (
            "packages/theme/esm/tracked.cjs",
            "module.exports='tracked';",
        ),
        (
            "packages/theme/esm/untracked.cjs",
            "module.exports='untracked';",
        ),
        (
            "packages/theme/esm/ignored-source.cjs",
            "module.exports='ignored';",
        ),
        (
            "packages/theme/source/untracked.js",
            "module.exports='src';",
        ),
        (
            "packages/theme/source/ignored-source.js",
            "module.exports='src';",
        ),
        (
            "packages/theme/esm/index.mjs",
            "export const label = 'Built';",
        ),
        (
            "packages/theme/esm/package.mjs",
            "export const other = 'Package';",
        ),
        ("packages/theme/esm/skin.css", ".theme { color: red }"),
        ("packages/theme/esm/package.css", ".package { color: red }"),
        (
            "packages/plugin-theme/dist/skin.css",
            ".plugin-theme { color: blue }",
        ),
        (
            "style.css",
            "@import './packages/theme/esm/skin.css'; @import 'workspace-theme/css'; @import 'generated/loose.css'; @import './untracked.css'; p { --fixture: before }",
        ),
        (
            "tailwind.css",
            "@import './generated/tailwind/direct.css'; @import 'plugin-theme/skin.css'; @reference './generated/tailwind/reference.css';",
        ),
        (
            "generated/tailwind/direct.css",
            "@import './nested.css'; .direct { color: red }",
        ),
        ("generated/tailwind/nested.css", ".nested { color: green }"),
        (
            "generated/tailwind/reference.css",
            "@theme { --color-test: red; }",
        ),
        ("generated/loose.css", ".loose { color: blue }"),
        ("untracked.css", ".untracked { color: green }"),
        (
            "specs/page.mockup.ts",
            "import {definePage} from '@mokly/mokly'; import {label} from '../packages/theme/esm/index.mjs'; import {other} from 'workspace-theme/js'; import '../packages/theme/esm/skin.css'; export default definePage({title:'Page',description:'',relatedDocs:[],render:()=>`<!doctype html><html><head><title>Page</title></head><body>${label} ${other}</body></html>`});",
        ),
    ] {
        write(path, file, bytes);
    }
    root
}
