//! CSS watch inputs retain every authored alias of selected dependency roots.

use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_catalogue::working_tree::WorkingTree;
use mokly_graph::types::{GraphFactory, RenderGeneration};
use mokly_test_support::capture::Trace;

use super::support::{Consumer, link_directory};

fn generation(consumer: &Consumer, misses: &[&str]) -> Arc<dyn RenderGeneration> {
    let trace = Trace::default();
    let generation = trace.in_scope(|| {
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
        let prepared = builder.prepare(&config, None).unwrap();
        let factory: &dyn GraphFactory = consumer.runtime.as_ref();
        factory
            .create(&config)
            .unwrap()
            .prepare(config, prepared, None)
            .unwrap()
    });
    let bundles: Vec<_> = trace
        .spans()
        .into_iter()
        .filter(|span| span.name == "css.bundle")
        .map(|span| span.fields["cache"].clone())
        .collect();
    assert_eq!(bundles, misses);
    generation
}

#[test]
fn resolution_watch_files_keep_all_dependency_root_aliases_on_compile_and_reuse() {
    let consumer = Consumer::single();
    consumer.without_installation();
    consumer.write(
        "app/mokly.config.json",
        r#"{
          "repoRoot":"..",
          "roots":[{"dir":"specs","files":["**/*.screen.html"]}],
          "moduleResolution":{
            "packageRoots":["../vendor-a","../vendor-b"],
            "resolveExtensions":[".preferred.css",".css"]
          },
          "stylesheets":[{"match":"**","stylesheets":["theme.css"]}]
        }"#,
    );
    consumer.write(
        "app/specs/home.screen.html",
        "---\ntitle: Watch aliases\n---\n<p>Watch aliases</p>\n",
    );
    consumer.write(
        "app/theme.css",
        "@import 'primary-theme/tokens';\n@import 'secondary-theme/tokens';\n",
    );
    consumer.write("install-one/primary-theme/package.json", "{}");
    consumer.write(
        "install-one/primary-theme/tokens.css",
        ".primary {color:red}",
    );
    consumer.write("install-two/secondary-theme/package.json", "{}");
    consumer.write(
        "install-two/secondary-theme/tokens.css",
        ".secondary {color:blue}",
    );
    for alias in ["app/node_modules", "node_modules"] {
        link_directory(
            &consumer.root().join("install-one"),
            &consumer.root().join(alias),
        );
    }
    for alias in ["vendor-a", "vendor-b"] {
        consumer.write(&format!("{alias}/package.json"), "{}");
        link_directory(
            &consumer.root().join("install-two"),
            &consumer.root().join(alias).join("node_modules"),
        );
    }

    let first = generation(&consumer, &["no-record"]);
    let files = first.stylesheet_resolution_files();
    for expected in [
        "app/node_modules",
        "node_modules",
        "install-one",
        "app/node_modules/primary-theme/package.json",
        "node_modules/primary-theme/package.json",
        "install-one/primary-theme/package.json",
        "app/node_modules/primary-theme/tokens.preferred.css",
        "node_modules/primary-theme/tokens.preferred.css",
        "install-one/primary-theme/tokens.preferred.css",
        "vendor-a/node_modules",
        "vendor-b/node_modules",
        "install-two",
        "vendor-a/node_modules/secondary-theme/package.json",
        "vendor-b/node_modules/secondary-theme/package.json",
        "install-two/secondary-theme/package.json",
        "vendor-a/node_modules/secondary-theme/tokens.preferred.css",
        "vendor-b/node_modules/secondary-theme/tokens.preferred.css",
        "install-two/secondary-theme/tokens.preferred.css",
    ] {
        assert!(files.contains(expected), "missing {expected}: {files:?}");
    }
    assert!(
        !files.iter().any(|path| path.contains(".mokly-roots")),
        "{files:?}"
    );
    let cached = generation(&consumer, &[]);
    assert_eq!(cached.stylesheet_resolution_files(), files);
}
