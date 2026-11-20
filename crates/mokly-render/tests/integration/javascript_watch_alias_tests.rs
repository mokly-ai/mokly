//! JavaScript watch paths keep selected installations and every authored alias.

use std::io;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder, PreparedCatalogue};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_render::runtime::Runtime;
use mokly_sidecar::operations::Operation;
use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::{SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use super::support::{Consumer, link_directory};

fn prepare(consumer: &Consumer) -> PreparedCatalogue {
    let loader: &dyn ConfigLoader = &Loader {
        tree: Arc::new(WorkingTree),
    };
    let config = loader
        .load(consumer.root(), Some("app/mokly.config.json"))
        .unwrap();
    let builder: &dyn CatalogueBuilder = &Builder {
        tree: Arc::new(WorkingTree),
        discovery: Arc::new(Discoverer {
            tree: Arc::new(WorkingTree),
        }),
        definitions: consumer.runtime.clone(),
    };
    builder.prepare(&config, None).unwrap()
}

#[test]
fn javascript_watch_inputs_keep_all_aliases_and_rejected_candidates_on_compile_and_reuse() {
    aliases_on_compile_and_reuse(
        "install-two",
        "node_modules/.mokly-roots/1/secondary-value/index.js",
        &[],
    );
    aliases_on_compile_and_reuse(
        "install-one/installation-two",
        "node_modules/installation-two/secondary-value/index.js",
        &[
            ("app/node_modules/installation-two", "app/node_modules"),
            ("node_modules/installation-two", "node_modules"),
        ],
    );
}

fn aliases_on_compile_and_reuse(
    secondary_root: &str,
    logical_module: &str,
    secondary_aliases: &[(&str, &str)],
) {
    let mut consumer = Consumer::single();
    consumer.without_installation();
    consumer.write(
        "app/mokly.config.json",
        r#"{
          "repoRoot":"..",
          "roots":[{"dir":"specs","files":["**/*.screen.html"]}],
          "renderer":"renderer.mjs",
          "moduleResolution":{"packageRoots":["../vendor-a","../vendor-b"]}
        }"#,
    );
    consumer.write(
        "app/specs/home.screen.html",
        "---\ntitle: Watch aliases\n---\n<p>Watch aliases</p>\n",
    );
    consumer.write(
        "app/renderer.mjs",
        "import {value as one} from 'primary-value'; import {value as two} from 'secondary-value'; export default () => ({node:one+two});",
    );
    for (installation, package) in [
        ("install-one", "primary-value"),
        (secondary_root, "secondary-value"),
    ] {
        consumer.write(
            &format!("{installation}/{package}/package.json"),
            r#"{"main":"index.js"}"#,
        );
        consumer.write(
            &format!("{installation}/{package}/index.js"),
            "export const value = 'watch';",
        );
    }
    for alias in ["app/node_modules", "node_modules"] {
        link_directory(
            &consumer.root().join("install-one"),
            &consumer.root().join(alias),
        );
    }
    for alias in ["vendor-a", "vendor-b"] {
        consumer.write(&format!("{alias}/package.json"), "{}");
        link_directory(
            &consumer.root().join(secondary_root),
            &consumer.root().join(alias).join("node_modules"),
        );
    }
    let inventory = Arc::new(Unimock::new(
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                if path.ends_with("primary-value/tsconfig.json") {
                    return Err(SourceError::Io {
                        operation: "project",
                        path: path.into(),
                        source: io::Error::from(io::ErrorKind::PermissionDenied),
                    });
                }
                WorkingTree.project(path)
            }),
    ));
    consumer.runtime = Arc::new(
        Runtime::new(
            inventory,
            Arc::new(WorkingTree),
            consumer.runtime.physical_inputs.clone(),
            consumer.pool.clone(),
            consumer.runtime.cache.clone(),
            consumer.runtime.workers.clone(),
            consumer.runtime.version.clone(),
            None,
        )
        .with_resolution_watching()
        .with_tree(Arc::new(WorkingTree)),
    );

    let first = prepare(&consumer);
    let generation = first.javascript.generation.as_ref().unwrap();
    assert!(
        generation.modules.contains_key(logical_module),
        "the sidecar must report the intended logical name: {logical_module}; {:?}",
        generation.modules
    );
    let files = &generation.resolution_inputs.files;
    let expected = [
        ("app/node_modules", "primary-value"),
        ("node_modules", "primary-value"),
        ("install-one", "primary-value"),
        ("vendor-a/node_modules", "secondary-value"),
        ("vendor-b/node_modules", "secondary-value"),
        (secondary_root, "secondary-value"),
    ]
    .into_iter()
    .map(|(root, package)| (root, package, root))
    .chain(
        secondary_aliases
            .iter()
            .map(|(path, admitting)| (*path, "secondary-value", *admitting)),
    );
    for (root, package, admitting) in expected {
        for name in ["index.js", "package.json", "tsconfig.json"] {
            let file = format!("{root}/{package}/{name}");
            assert!(files.contains(&file), "missing {file}: {files:?}");
            assert_eq!(
                generation.resolution_inputs.dependency_roots.get(&file),
                Some(&consumer.repository().join(admitting)),
                "each written path keeps its own admitting directory: {file}"
            );
        }
        let directory = format!("{root}/{package}");
        assert!(
            generation.resolution_directories.contains_key(&directory),
            "missing directory {directory}: {:?}",
            generation.resolution_directories
        );
    }
    assert!(!files.iter().any(|file| file.contains(".mokly-roots")));
    assert!(
        !generation
            .resolution_directories
            .keys()
            .any(|path| path.contains(".mokly-roots"))
    );
    let cached = prepare(&consumer);
    let reused = cached.javascript.generation.as_ref().unwrap();
    assert_eq!(reused.id, generation.id);
    assert_eq!(reused.resolution_inputs, generation.resolution_inputs);
    assert_eq!(
        reused.resolution_directories,
        generation.resolution_directories
    );
    assert_eq!(consumer.processes.count(Operation::Esbuild), 1);
    assert_eq!(
        first.model.sources,
        vec![
            "app/mokly.config.json",
            "app/renderer.mjs",
            "app/specs/home.screen.html"
        ]
    );
}
