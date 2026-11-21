//! Observed plugin configuration reads invalidate reuse inside one Serve runtime.

use std::fs;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_graph::cache::MemoryCache;
use mokly_graph::types::{GraphFactory, RenderGeneration};
use mokly_render::runtime::Runtime;
use mokly_sidecar::methods::BundleCapture;

use super::base_stylesheet_support::generation;
use super::stylesheet_reuse_tests::requests;
use super::support::{Consumer, link_directory};

const PREFIXED: &str = "p {\n  -webkit-user-select: none;\n  user-select: none;\n}\n";
const UNPREFIXED: &str = "p {\n  user-select: none;\n}\n";

fn runtime(consumer: &Consumer) -> Arc<Runtime> {
    Arc::new(
        Runtime::new(
            consumer.runtime.tree.clone(),
            consumer.runtime.dependency_tree.clone(),
            consumer.runtime.physical_inputs.clone(),
            consumer.pool.clone(),
            Arc::new(MemoryCache::new(16 * 1024 * 1024, 0)),
            consumer.runtime.workers.clone(),
            consumer.runtime.version.clone(),
            None,
        )
        .with_stylesheet_watching()
        .with_serve_edit_plans(),
    )
}

fn catalogue() -> Consumer {
    let consumer = Consumer::single();
    fs::remove_dir_all(consumer.root().join("specs")).unwrap();
    consumer.write(
        "mokly.config.json",
        r#"{"roots":[{"dir":"specs"}],"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["main.css"]}]}"#,
    );
    consumer.write(
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p>Home</p>\n",
    );
    consumer.write("main.css", "p { user-select: none }\n");
    consumer.write(
        "postcss.mjs",
        "import autoprefixer from 'autoprefixer';\nexport default { plugins: [autoprefixer()] };\n",
    );
    consumer
}

fn css(generation: &Arc<dyn RenderGeneration>) -> String {
    stylesheet_css(generation, "main.css")
}

fn stylesheet_css(generation: &Arc<dyn RenderGeneration>, stylesheet: &str) -> String {
    String::from_utf8(
        generation
            .resource(&format!("styles/{stylesheet}"))
            .unwrap()
            .unwrap(),
    )
    .unwrap()
}

fn nested_generation(runtime: &Arc<Runtime>, consumer: &Consumer) -> Arc<dyn RenderGeneration> {
    let tree = runtime.tree.clone();
    let config = Loader { tree: tree.clone() }
        .load(consumer.root(), Some("app/mokly.config.json"))
        .unwrap();
    let catalogue = Builder {
        tree: tree.clone(),
        discovery: Arc::new(Discoverer { tree }),
        definitions: runtime.clone(),
    }
    .prepare(&config, None)
    .unwrap();
    runtime
        .create(&config)
        .unwrap()
        .prepare(config, catalogue, None)
        .unwrap()
}

#[test]
fn a_browserslist_edit_rebuilds_css_in_the_same_serve_runtime() {
    let mut outcomes = Vec::new();
    for (configuration, stylesheet) in [
        (".browserslistrc", "main.css"),
        ("browserslist", "main.css"),
        ("package.json", "main.css"),
        ("app/.browserslistrc", "app/styles/main.css"),
        ("app/browserslist", "app/styles/main.css"),
        ("app/package.json", "app/styles/main.css"),
    ] {
        let consumer = catalogue();
        consumer.replace("mokly.config.json", "main.css", stylesheet);
        consumer.write(stylesheet, "p { user-select: none }\n");
        let config = |query| {
            if configuration.ends_with("package.json") {
                format!(r#"{{"browserslist":["{query}"]}}"#)
            } else {
                format!("{query}\n")
            }
        };
        consumer.write(configuration, &config("Safari 14"));
        let mut serving = runtime(&consumer);
        let first = generation(&serving, &consumer).0;
        assert_eq!(
            stylesheet_css(&first, stylesheet),
            PREFIXED,
            "{configuration}"
        );
        assert_eq!(requests(&consumer).len(), 1);
        Arc::make_mut(&mut serving).bundle_capture = BundleCapture::ServeEdit;
        let unchanged = generation(&serving, &consumer).0;
        assert_eq!(stylesheet_css(&unchanged, stylesheet), PREFIXED);
        assert_eq!(requests(&consumer).len(), 1);

        consumer.write(configuration, &config("Chrome 130"));
        let edited = generation(&serving, &consumer).0;
        let control = generation(&runtime(&consumer), &consumer).0;
        assert_eq!(stylesheet_css(&control, stylesheet), UNPREFIXED);
        outcomes.push((
            configuration,
            stylesheet_css(&edited, stylesheet),
            requests(&consumer).len(),
        ));
    }
    eprintln!("Browserslist edit outcomes: {outcomes:?}");
    for (configuration, edited, count) in outcomes {
        assert_eq!(edited, UNPREFIXED, "{configuration}");
        assert_eq!(count, 3, "{configuration}");
    }
}

#[test]
fn undeclared_whole_and_range_reads_invalidate_css_without_protecting_public_files() {
    let mut outputs = Vec::new();
    for reader in [
        "fs.readFileSync(file, 'utf8').slice(0, 3)",
        "(() => { const fd = fs.openSync(file, 'r'); const bytes = Buffer.alloc(3); fs.readSync(fd, bytes, 0, 3, 0); fs.closeSync(fd); return bytes.toString(); })()",
    ] {
        let consumer = catalogue();
        consumer.write("settings.txt", "red-other-settings\n");
        consumer.write("main.css", "p { color: SETTINGS }\n");
        consumer.write(
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<p>Home</p><a href=\"../../settings.txt\">Settings</a>\n",
        );
        consumer.write(
            "postcss.mjs",
            &format!(
                "import fs from 'node:fs';\nconst file = new URL('./settings.txt', import.meta.url);\n\
                 const setting = {reader};\n\
                 export default {{ plugins: [{{ postcssPlugin: 'settings', Declaration(d) {{\n\
                 if (d.value === 'SETTINGS') d.value = setting;\n}} }}] }};\n"
            ),
        );
        let mut serving = runtime(&consumer);
        let first = generation(&serving, &consumer).0;
        assert_eq!(css(&first), "p {\n  color: red;\n}\n", "{reader}");
        assert!(
            !first
                .catalogue()
                .inventory
                .sources
                .contains(&"settings.txt".into())
        );
        let closure = first.closure("home/index.mobile.html").unwrap();
        assert!(closure.files.contains("settings.txt"));
        assert_eq!(requests(&consumer).len(), 1);
        Arc::make_mut(&mut serving).bundle_capture = BundleCapture::ServeEdit;
        let unchanged = generation(&serving, &consumer).0;
        assert_eq!(css(&unchanged), css(&first));
        assert_eq!(requests(&consumer).len(), 1);

        consumer.write("settings.txt", "tan-other-settings\n");
        let edited = generation(&serving, &consumer).0;
        let control = generation(&runtime(&consumer), &consumer).0;
        assert_eq!(css(&control), "p {\n  color: tan;\n}\n");
        let closure = edited.closure("home/index.mobile.html").unwrap();
        assert!(closure.files.contains("settings.txt"));
        outputs.push((
            reader,
            css(&edited),
            css(&control),
            requests(&consumer).len(),
        ));
    }
    eprintln!("Undeclared read edit outcomes: {outputs:?}");
    for (reader, edited, control, count) in outputs {
        assert_eq!(edited, control, "{reader}");
        assert_eq!(count, 3, "{reader}");
    }
}

#[test]
fn a_source_alias_keeps_its_own_config_and_reuses_unchanged_css() {
    let consumer = catalogue();
    consumer.without_installation();
    consumer.write(
        "app/mokly.config.json",
        r#"{"repoRoot":"..","roots":[{"dir":"../specs"}],"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["../main.css"]}]}"#,
    );
    consumer.write("main.css", "p { color: SETTINGS }\n");
    consumer.write("app/node_modules/workspace/settings.txt", "blue");
    consumer.write("packages/workspace/settings.txt", "red");
    link_directory(
        &consumer.root().join("packages"),
        &consumer.root().join("node_modules"),
    );
    consumer.write(
        "app/postcss.mjs",
        "import fs from 'node:fs';\n\
         const setting = fs.readFileSync(new URL('../node_modules/workspace/settings.txt', import.meta.url), 'utf8');\n\
         export default { plugins: [{ postcssPlugin: 'settings', Declaration(d) {\n\
         if (d.value === 'SETTINGS') d.value = setting;\n} }] };\n",
    );
    consumer.write(
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p>Home</p><a href=\"../../packages/workspace/settings.txt\">Settings</a>\n",
    );
    let mut serving = runtime(&consumer);
    let first = nested_generation(&serving, &consumer);
    assert_eq!(css(&first), "p {\n  color: red;\n}\n");
    assert_eq!(requests(&consumer).len(), 1);
    let closure = first.closure("home/index.mobile.html").unwrap();
    assert!(closure.files.contains("packages/workspace/settings.txt"));
    assert!(
        first
            .catalogue()
            .inventory
            .sources
            .iter()
            .all(|path| { !path.ends_with("workspace/settings.txt") })
    );

    Arc::make_mut(&mut serving).bundle_capture = BundleCapture::ServeEdit;
    let unchanged = nested_generation(&serving, &consumer);
    assert_eq!(css(&unchanged), css(&first));
    assert_eq!(requests(&consumer).len(), 1);
    consumer.write("packages/workspace/settings.txt", "tan");
    let edited = nested_generation(&serving, &consumer);
    assert_eq!(css(&edited), "p {\n  color: tan;\n}\n");
    assert_eq!(requests(&consumer).len(), 2);
    let control = nested_generation(&runtime(&consumer), &consumer);
    assert_eq!(css(&control), "p {\n  color: tan;\n}\n");
    assert_eq!(css(&edited), css(&control));
    assert_eq!(requests(&consumer).len(), 3);
    assert_eq!(
        fs::read_to_string(
            consumer
                .root()
                .join("app/node_modules/workspace/settings.txt")
        )
        .unwrap(),
        "blue"
    );
}
