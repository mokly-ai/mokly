//! Complete terminal lines preserve typed consumer failures and source attribution.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

use tempfile::TempDir;

fn workspace() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap()
}
fn write(root: &Path, path: &str, text: &str) {
    let file = root.join(path);
    fs::create_dir_all(file.parent().unwrap()).unwrap();
    fs::write(file, text).unwrap();
}
fn fixture() -> TempDir {
    let directory = tempfile::tempdir().unwrap();
    write(directory.path(), "mokly.config.json", "{}");
    #[cfg(unix)]
    std::os::unix::fs::symlink(
        workspace().join("node_modules"),
        directory.path().join("node_modules"),
    )
    .unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(
        workspace().join("node_modules"),
        directory.path().join("node_modules"),
    )
    .unwrap();
    directory
}
fn run(cwd: &Path) -> Output {
    Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(["build", "--strict", "--no-changes", "--sidecars", "1"])
        .current_dir(cwd)
        .env("MOKLY_OUTPUT", "plain")
        .env("MOKLY_PACKAGE_ROOT", workspace().join("packages/mokly"))
        .env_remove("MOKLY_SIDECAR_TIMEOUT_MS")
        .output()
        .unwrap()
}
fn failure(root: &Path, expected: &str) {
    let output = run(root);
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    assert_eq!(String::from_utf8(output.stderr).unwrap(), expected);
}

#[test]
fn postcss_failures_use_exact_catalogued_codes_and_logical_paths() {
    for (module, expected) in [
        (
            "throw new Error('configuration exploded'); export default {};",
            "[mokly/config-invalid] could not load postcss module postcss.mjs: configuration exploded; default-export an object with plugins\n",
        ),
        (
            "export default null;",
            "[mokly/config-invalid] could not load postcss module postcss.mjs: invalid default export; default-export an object with plugins\n",
        ),
        (
            "export default {unknown: true};",
            "[mokly/config-invalid] postcss configuration has unsupported key: unknown; only plugins and map are supported\n",
        ),
        (
            "export default {};",
            "[mokly/config-invalid] postcss plugins must be an array of plugin instances or an object mapping package names to option objects\n",
        ),
        (
            "export default {plugins:[{postcssPlugin:'broken-plugin',Once(){throw new Error('plugin exploded')}}]};",
            "[mokly/build-invalid] PostCSS plugin broken-plugin failed for styles/input.css: plugin exploded; fix the plugin configuration or stylesheet\n",
        ),
        (
            "export default {plugins:[{postcssPlugin:'bad-dependency',Once(root,{result}){result.messages.push({type:'dependency',plugin:'bad-dependency',file:42})}}]};",
            "[mokly/build-invalid] PostCSS plugin bad-dependency reported an invalid dependency for styles/input.css; report a file or directory path and optional glob\n",
        ),
        (
            "export default {plugins:[{postcssPlugin:'missing-dependency',Once(root,{result}){result.messages.push({type:'dependency',plugin:'missing-dependency',file:'missing.txt'})}}]};",
            "[mokly/build-invalid] PostCSS plugin missing-dependency reported a missing dependency for styles/input.css: styles/missing.txt; make it a regular file or correct the plugin\n",
        ),
        (
            "export default {plugins:[{postcssPlugin:'async-plugin',async Once(){throw new Error('async exploded')}}]};",
            "[mokly/build-invalid] PostCSS plugin async-plugin failed for styles/input.css: async exploded; fix the plugin configuration or stylesheet\n",
        ),
        (
            "export default {plugins:[{postcssPlugin:'prepared-plugin',prepare(){return {Once(){throw new Error('prepared exploded')}}}}]};",
            "[mokly/build-invalid] PostCSS plugin prepared-plugin failed for styles/input.css: prepared exploded; fix the plugin configuration or stylesheet\n",
        ),
        (
            "export default {plugins:[3]};",
            "[mokly/config-invalid] postcss plugins[0] is not a PostCSS 8 plugin: 3 is not a PostCSS plugin; use a plugin instance, creator, function or object with a postcss factory\n",
        ),
        (
            "export default {plugins:{unused:null}};",
            "[mokly/config-invalid] postcss plugins[unused] must be a plain option object\n",
        ),
        (
            "export default {plugins:{'./throwing-plugin.cjs':{}}};",
            "[mokly/config-invalid] could not load PostCSS plugin ./throwing-plugin.cjs from postcss.mjs: factory exploded; install and configure it in the consumer repository\n",
        ),
    ] {
        let root = fixture();
        write(
            root.path(),
            "mokly.config.json",
            r#"{"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["styles/input.css"]}]}"#,
        );
        write(root.path(), "postcss.mjs", module);
        write(
            root.path(),
            "throwing-plugin.cjs",
            "module.exports = () => { throw new Error('factory exploded'); };",
        );
        write(root.path(), "styles/input.css", "p {color:red}");
        write(
            root.path(),
            "specs/a.screen.html",
            "---\ntitle: A\n---\n<p>A</p>",
        );
        failure(root.path(), expected);
    }
}

#[test]
fn javascript_diagnostics_keep_module_exports_and_exact_variant_text() {
    let root = fixture();
    for (field, expected) in [
        (
            "path:'forbidden'",
            "[mokly/build-invalid] specs/item.mockup.ts export widget (final/one): [mokly/invalid-field] unknown field path\n",
        ),
        (
            "variants:[]",
            "[mokly/build-invalid] specs/item.mockup.ts export widget (final/one): [mokly/invalid-variants] a variant cannot declare variants\n",
        ),
    ] {
        write(
            root.path(),
            "specs/item.mockup.ts",
            &format!(
                "import {{defineComponent}} from '@mokly/mokly'; export const widget=defineComponent({{path:'final',title:'Widget',description:'',relatedDocs:[],propSchema:{{type:'object',additionalProperties:false,properties:{{}}}},props:{{}},render:()=>null,variants:[{{slug:'one',title:'One',props:{{}},{field}}}]}});"
            ),
        );
        failure(root.path(), expected);
    }
    write(
        root.path(),
        "specs/item.mockup.ts",
        "import {definePage} from '@mokly/mokly'; export default definePage({title:'Page',description:'',relatedDocs:[],render:()=> '<!doctype html><html><head><title>Page</title></head><body><main>{{name}}</main></body></html>'});",
    );
    failure(
        root.path(),
        "[mokly/build-invalid] specs/item.mockup.ts export default: [mokly/html-props] undeclared prop reference name\n",
    );
    write(
        root.path(),
        "specs/item.mockup.ts",
        "import {defineScreen} from '@mokly/mokly'; export const values=[defineScreen({title:'A',description:'',relatedDocs:[],props:{},render:()=> 'A'})];",
    );
    failure(
        root.path(),
        "[mokly/build-invalid] [mokly/array-export] specs/item.mockup.ts export values: export values is an array; export one definition per export\n[mokly/build-invalid] [mokly/empty-module] specs/item.mockup.ts exports no Mokly definition\n",
    );
}

#[test]
fn bundle_and_render_failures_have_no_internal_wrapper_text() {
    let root = fixture();
    write(
        root.path(),
        "specs/item.mockup.ts",
        "throw new Error('evaluation exploded'); export const data=1;",
    );
    failure(
        root.path(),
        "[mokly/build-invalid] specs/item.mockup.ts: evaluation exploded\n",
    );
    write(
        root.path(),
        "specs/item.mockup.ts",
        "import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'A',description:'',relatedDocs:[],props:{},render:()=> {throw new Error('render exploded')}});",
    );
    failure(
        root.path(),
        "[mokly/build-invalid] specs/item.mockup.ts export default (desktop, light): render exploded\n[mokly/build-invalid] specs/item.mockup.ts export default (mobile, light): render exploded\n",
    );
}

#[test]
fn sidecars_start_in_the_resolved_repository_from_a_nested_invocation() {
    let root = fixture();
    fs::create_dir(root.path().join("nested")).unwrap();
    let expected = serde_json::to_string(root.path().to_str().unwrap()).unwrap();
    write(
        root.path(),
        "specs/item.mockup.ts",
        &format!(
            "import {{definePage}} from '@mokly/mokly'; export default definePage({{title:'Page',description:'',relatedDocs:[],render:()=> {{if(process.cwd()!=={expected}) throw new Error('wrong working directory'); return '<!doctype html><html><head><title>Page</title></head><body>Page</body></html>';}}}});"
        ),
    );
    let output = run(&root.path().join("nested"));
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());
}

#[test]
fn plugin_attribution_preserves_the_original_prepare_receiver() {
    let root = fixture();
    write(
        root.path(),
        "mokly.config.json",
        r#"{"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["style.css"]}]}"#,
    );
    write(
        root.path(),
        "postcss.mjs",
        "const plugin={postcssPlugin:'receiver',count:0,prepare(){this.count++;return {Once(){if(plugin.count!==1) throw new Error('plugin receiver changed')}}}}; export default {plugins:[plugin]};",
    );
    write(root.path(), "style.css", "p {color:red}");
    write(
        root.path(),
        "specs/a.screen.html",
        "---\ntitle: A\n---\n<p>A</p>",
    );
    let output = run(root.path());
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());
}
